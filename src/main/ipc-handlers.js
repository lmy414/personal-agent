/**
 * IPC handlers — the contract between renderer (frontend) and main (backend).
 * Renderer calls these via window.electronAPI.*
 */
const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { getDb } = require('./db');
const { sendMessageStream, getModelDisplayName, getModelPricing, PRICING } = require('./api');
const { recordUsage, getStats } = require('./usage');

let workspaceRoot = '';

function isPathSafe(targetPath) {
  if (!workspaceRoot) return true; // not configured yet, allow
  const resolved = path.resolve(targetPath);
  const root = path.resolve(workspaceRoot);
  return resolved.startsWith(root + path.sep) || resolved === root;
}

function registerHandlers() {
  const db = getDb();

  // ────────── Settings ──────────
  ipcMain.handle('settings:get', () => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    return settings;
  });

  ipcMain.handle('settings:save', (_event, updates) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(updates)) {
      stmt.run(key, String(value));
    }
    return { ok: true };
  });

  // ────────── API Test ──────────
  ipcMain.handle('api:test', async (_event, { apiKey, baseUrl }) => {
    const https = require('https');
    const http = require('http');

    return new Promise((resolve) => {
      const url = new URL('/v1/chat/completions', baseUrl || 'https://api.deepseek.com');
      const body = JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });

      const transport = url.protocol === 'https:' ? https : http;
      const req = transport.request({
        hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname, method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (j.error) {
              resolve({ ok: false, error: j.error.message });
            } else {
              resolve({ ok: true, latency: 'connected' });
            }
          } catch (_) {
            resolve({ ok: false, error: 'Invalid response' });
          }
        });
      });
      req.on('error', (e) => resolve({ ok: false, error: e.message }));
      req.write(body);
      req.end();
    });
  });

  // ────────── Conversations ──────────
  ipcMain.handle('conversations:list', () => {
    return db.prepare(
      'SELECT c.*, (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as msg_count FROM conversations c ORDER BY updated_at DESC'
    ).all();
  });

  ipcMain.handle('conversations:create', (_event, title) => {
    const result = db.prepare(
      'INSERT INTO conversations (title) VALUES (?)'
    ).run(title || 'New Chat');
    return { id: result.lastInsertRowid, title: title || 'New Chat' };
  });

  ipcMain.handle('conversations:delete', (_event, id) => {
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    return { ok: true };
  });

  ipcMain.handle('conversations:rename', (_event, id, title) => {
    db.prepare('UPDATE conversations SET title = ?, updated_at = datetime(\"now\",\"localtime\") WHERE id = ?').run(title, id);
    return { ok: true };
  });

  ipcMain.handle('conversations:getMessages', (_event, conversationId) => {
    return db.prepare(
      'SELECT id, role, content, tokens_input, tokens_output, model, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC'
    ).all(conversationId);
  });

  // ────────── Chat ──────────
  ipcMain.handle('chat:send', async (event, { conversationId, messages, settings }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const model = settings.default_model || 'claude-sonnet-4-6-20250514';
    const maxTokens = parseInt(settings.max_tokens) || 4096;
    const temp = parseFloat(settings.temperature) || 0.7;
    const streamEnabled = settings.stream_enabled === 'true';

    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content,
    }));

    let fullContent = '';
    let tokensInput = 0;
    let tokensOutput = 0;
    let modelUsed = model;

    if (streamEnabled) {
      fullContent = '';
      const result = await sendMessageStream({
        messages: chatMessages,
        system: systemMsg?.content || settings.system_prompt,
        model,
        maxTokens,
        temperature: temp,
        settings,
        onToken: (token) => {
          fullContent += token;
          if (win && !win.isDestroyed()) {
            win.webContents.send('chat:token', { conversationId, token });
          }
        },
      });
      tokensInput = result.tokensInput;
      tokensOutput = result.tokensOutput;
      modelUsed = result.model;
    } else {
      const result = await sendMessage({
        messages: chatMessages,
        system: systemMsg?.content || settings.system_prompt,
        model,
        maxTokens,
        temperature: temp,
        settings,
      });
      fullContent = result.content;
      tokensInput = result.tokensInput;
      tokensOutput = result.tokensOutput;
      modelUsed = result.model;
    }

    // Save user message
    const lastUserMsg = chatMessages.filter(m => m.role === 'user').pop();
    if (lastUserMsg) {
      db.prepare(
        'INSERT INTO messages (conversation_id, role, content, model) VALUES (?, ?, ?, ?)'
      ).run(conversationId, 'user', lastUserMsg.content, model);
    }

    // Save assistant message with usage
    db.prepare(
      'INSERT INTO messages (conversation_id, role, content, tokens_input, tokens_output, model) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(conversationId, 'assistant', fullContent, tokensInput, tokensOutput, modelUsed);

    // Update conversation timestamp & auto-title
    const msgCount = db.prepare('SELECT COUNT(*) as c FROM messages WHERE conversation_id = ?').get(conversationId);
    if (msgCount.c <= 2) {
      const title = lastUserMsg?.content?.slice(0, 40) || 'New Chat';
      db.prepare("UPDATE conversations SET title = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(title, conversationId);
    } else {
      db.prepare("UPDATE conversations SET updated_at = datetime('now','localtime') WHERE id = ?").run(conversationId);
    }

    // Record usage
    recordUsage(modelUsed, tokensInput, tokensOutput);

    // Notify usage update
    if (win && !win.isDestroyed()) {
      const stats = getStats('today');
      win.webContents.send('usage:updated', {
        today: {
          tokens: stats.totalTokens,
          costCny: stats.totalCostCny,
        },
        month: getStats('month'),
      });
    }

    return {
      content: fullContent,
      tokensInput,
      tokensOutput,
      model: modelUsed,
    };
  });

  // ────────── Usage Stats ──────────
  ipcMain.handle('usage:stats', (_event, period) => {
    return getStats(period || 'month');
  });

  ipcMain.handle('usage:pricing', () => {
    return PRICING;
  });

  // ────────── Models (dynamic from API) ──────────
  ipcMain.handle('models:list', async (_event, { apiKey, baseUrl } = {}) => {
    const settings = db.prepare('SELECT key, value FROM settings').all().reduce((o, r) => { o[r.key] = r.value; return o; }, {});
    const key = apiKey || settings.api_key;
    const url = baseUrl || settings.api_base_url || 'https://api.deepseek.com';

    if (!key) return { error: '未配置 API Key', models: [] };

    const https = require('https');
    const http = require('http');
    const apiUrl = new URL('/v1/models', url);

    return new Promise((resolve) => {
      const transport = apiUrl.protocol === 'https:' ? https : http;
      const req = transport.request({
        hostname: apiUrl.hostname,
        port: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80),
        path: apiUrl.pathname,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${key}` },
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (j.error) { resolve({ error: j.error.message, models: [] }); return; }
            const models = (j.data || []).map(m => ({
              id: m.id,
              name: m.id,
              owned_by: m.owned_by || '',
            }));
            resolve({ models });
          } catch (_) { resolve({ error: 'Invalid response', models: [] }); }
        });
      });
      req.on('error', (e) => resolve({ error: e.message, models: [] }));
      req.end();
    });
  });

  // ────────── Shell ──────────
  ipcMain.handle('shell:openExternal', async (_event, url) => {
    const { shell } = require('electron');
    return shell.openExternal(url);
  });

  // ────────── File System ──────────
  ipcMain.handle('fs:setWorkspace', (_event, dirPath) => {
    if (typeof dirPath !== 'string' || !dirPath.trim()) {
      return { error: 'Invalid workspace path' };
    }
    const fs = require('fs');
    try {
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        return { error: 'Path is not a directory' };
      }
      workspaceRoot = path.resolve(dirPath);
      return { ok: true, root: workspaceRoot };
    } catch (e) {
      return { error: `Cannot access: ${e.message}` };
    }
  });

  ipcMain.handle('fs:listDir', async (_event, dirPath) => {
    const fs = require('fs');
    if (!isPathSafe(dirPath)) {
      return { error: `Access denied: "${dirPath}" is outside workspace` };
    }
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'folder' : 'file',
        ext: e.isFile() ? e.name.split('.').pop()?.toLowerCase() || '' : '',
      }));
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('fs:readFile', async (_event, filePath) => {
    const fs = require('fs');
    if (!isPathSafe(filePath)) {
      return { error: `Access denied: "${filePath}" is outside workspace` };
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { content };
    } catch (e) {
      return { error: e.message };
    }
  });
}

module.exports = { registerHandlers };
