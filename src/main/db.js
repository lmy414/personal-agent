const Database = require('better-sqlite3');
const path = require('path');
const { app, safeStorage } = require('electron');

let db;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'agent.db');
}

function encryptApiKey(plain) {
  if (!plain || !safeStorage.isEncryptionAvailable()) return plain || '';
  return safeStorage.encryptString(plain).toString('base64');
}

function decryptApiKey(encrypted) {
  if (!encrypted || !safeStorage.isEncryptionAvailable()) return encrypted || '';
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  } catch (_) {
    return encrypted; // legacy plaintext key
  }
}

function init() {
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
      content TEXT NOT NULL,
      tokens_input INTEGER DEFAULT 0,
      tokens_output INTEGER DEFAULT 0,
      model TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL DEFAULT (date('now','localtime')),
      model TEXT NOT NULL,
      tokens_input INTEGER NOT NULL DEFAULT 0,
      tokens_output INTEGER NOT NULL DEFAULT 0,
      request_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default settings if not exist
  const defaults = {
    api_provider: 'deepseek',
    api_key: '',
    api_base_url: 'https://api.deepseek.com',
    default_model: 'deepseek-chat',
    temperature: '0.7',
    max_tokens: '4096',
    max_steps: '10',
    context_limit: '64000',
    system_prompt: '你是用户的个人 AI 助手，擅长资料收集、文章撰写和信息查询。回答应简洁准确，必要时使用 Markdown 格式化输出。',
    stream_enabled: 'true',
    auto_compress: 'true',
    monthly_budget: '50',
    daily_budget: '10',
    budget_warn: 'true',
    budget_stop: 'false',
    ignore_patterns: 'node_modules/\n.git/\n*.exe\n*.dll\n*.obj\n.env\n*.log\n__pycache__/\n*.pyc',
    workspace_dir: 'D:\\claude',
  };

  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, value);
  }

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call init() first.');
  return db;
}

module.exports = { init, getDb, encryptApiKey, decryptApiKey };
