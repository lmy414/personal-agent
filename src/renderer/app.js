/**
 * App — main orchestrator. Initializes chat, settings, and usage monitoring.
 * All backend calls go through window.electronAPI (defined in preload.js).
 */

// ── Global State ──
const App = {
  settings: {},
  currentConversationId: null,
  conversations: [],
  usage: { today: { tokens: 0, costCny: 0 }, month: {} },
  initialized: false,
};

// ── DOM refs ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  convList: $('#conv-list'),
  btnNewChat: $('#btn-new-chat'),
  chatMessages: $('#chat-messages'),
  inputBox: $('#input-box'),
  btnSend: $('#btn-send'),
  modelSelect: $('#model-select'),
  tokenDisplay: $('#token-display'),
  modelBadge: $('#current-model-badge'),
  btnClearContext: $('#btn-clear-context'),
  btnOpenSettings: $('#btn-open-settings'),
};

// ── Auto-resize textarea ──
dom.inputBox.addEventListener('input', () => {
  dom.inputBox.style.height = 'auto';
  dom.inputBox.style.height = Math.min(dom.inputBox.scrollHeight, 140) + 'px';
});

// ── Enter to send, Shift+Enter for newline ──
dom.inputBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    Chat.sendMessage();
  }
});

dom.btnSend.addEventListener('click', () => Chat.sendMessage());

// ── Model switch ──
dom.modelSelect.addEventListener('change', () => {
  const label = dom.modelSelect.options[dom.modelSelect.selectedIndex].text;
  dom.modelBadge.textContent = label;
  App.settings.default_model = dom.modelSelect.value;
  window.electronAPI.saveSettings({ default_model: dom.modelSelect.value });
});

// ── Initialize ──
async function init() {
  try {
    // Load settings
    App.settings = await window.electronAPI.getSettings();
    applySettings();

    // Load conversations
    App.conversations = await window.electronAPI.listConversations();
    renderConvList();

    // Select or create a conversation
    if (App.conversations.length > 0) {
      await selectConversation(App.conversations[0].id);
    } else {
      await createNewConversation();
    }

    // Load models from API
    await refreshModels();

    // Load usage
    await refreshUsage();

    // Listen for stream tokens
    window.electronAPI.onStreamToken(({ conversationId, token }) => {
      if (conversationId === App.currentConversationId) {
        Chat.handleStreamToken(token);
      }
    });

    // Listen for usage updates
    window.electronAPI.onUsageUpdated((data) => {
      App.usage.today = data.today;
      App.usage.month = data.month;
    });

    App.initialized = true;
  } catch (err) {
    console.error('Init error:', err);
    // Show error in chat area
    dom.chatMessages.innerHTML = `<div style="color:var(--danger);text-align:center;padding:40px;">
      <strong>初始化失败</strong><br>${escapeHtml(err.message)}<br><br>
      <small>请检查设置中的 API Key 是否正确。</small>
    </div>`;
  }
}

function applySettings() {
  const s = App.settings;
  // Set model select
  if (s.default_model) {
    dom.modelSelect.value = s.default_model;
    const opt = dom.modelSelect.options[dom.modelSelect.selectedIndex];
    if (opt) dom.modelBadge.textContent = opt.text;
  }
}

// ── Conversation Management ──
function renderConvList() {
  dom.convList.innerHTML = App.conversations.map(c => {
    const isActive = c.id === App.currentConversationId;
    return `<div class="conv-item${isActive ? ' active' : ''}" data-id="${c.id}">
      <span class="icon">${(c.title || 'C')[0].toUpperCase()}</span>
      <span class="info">
        <span class="name">${escapeHtml(c.title || 'New Chat')}</span>
        <span class="preview">${c.msg_count || 0} 条消息</span>
      </span>
      <span class="time">${formatTime(c.updated_at)}</span>
    </div>`;
  }).join('');

  // Click handlers
  dom.convList.querySelectorAll('.conv-item').forEach(el => {
    el.addEventListener('click', () => selectConversation(parseInt(el.dataset.id)));
  });
}

async function selectConversation(id) {
  App.currentConversationId = id;
  renderConvList();

  // Load messages
  const msgs = await window.electronAPI.getMessages(id);
  dom.chatMessages.innerHTML = '';
  if (msgs.length === 0) {
    dom.chatMessages.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;flex-direction:column;gap:8px;">
      <span style="font-size:28px;opacity:0.3;">💬</span>
      <span>开始新对话</span>
    </div>`;
  } else {
    msgs.forEach(m => Chat.renderMessage(m.role, m.content, m.tokens_input + m.tokens_output, m.model));
  }
  Chat.scrollToBottom();
}

async function createNewConversation() {
  const result = await window.electronAPI.createConversation('New Chat');
  App.conversations = await window.electronAPI.listConversations();
  await selectConversation(result.id);
}

dom.btnNewChat.addEventListener('click', createNewConversation);

// ── Usage ──
async function refreshUsage() {
  try {
    App.usage.month = await window.electronAPI.getUsageStats('month');
    App.usage.today = await window.electronAPI.getUsageStats('today');
  } catch (_) { /* settings not open, ignore */ }
}

// ── Models ──
async function refreshModels() {
  try {
    const result = await window.electronAPI.listModels();
    if (result.error || !result.models || result.models.length === 0) {
      console.log('Model fetch skipped:', result.error || 'empty list');
      return;
    }
    // Update select dropdown
    const select = dom.modelSelect;
    const current = select.value;
    select.innerHTML = result.models.map(m =>
      `<option value="${m.id}" ${m.id === current ? 'selected' : ''}>${m.id}</option>`
    ).join('');
    // Update badge
    const opt = select.options[select.selectedIndex];
    if (opt) dom.modelBadge.textContent = opt.text;
  } catch (_) { /* offline, keep defaults */ }
}

// ── Settings overlay ──
dom.btnOpenSettings.addEventListener('click', () => {
  Settings.open();
});

// ── Clear context ──
dom.btnClearContext.addEventListener('click', async () => {
  if (confirm('确定要清除当前对话的上下文？消息记录仍会保留。')) {
    await createNewConversation();
  }
});

// ═══════ SIDEBAR TABS ═══════
document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('panel-chats').classList.toggle('hidden', target !== 'chats');
    document.getElementById('panel-files').classList.toggle('visible', target === 'files');
    if (target === 'files') loadFileTree();
  });
});

// ═══════ FILE TREE ═══════
const stateFiles = {
  expandedFolders: new Set(),
  currentDir: 'D:\\claude',
};

const fileIcons = {
  folder: { cls: 'folder', icon: '📁' },
  folder_open: { cls: 'folder-open', icon: '📂' },
  md: { cls: 'file-md', icon: '📝' },
  py: { cls: 'file-py', icon: '🐍' },
  js: { cls: 'file-js', icon: '📜' },
  json: { cls: 'file-json', icon: '{ }' },
  css: { cls: 'file-css', icon: '🎨' },
  html: { cls: 'file-html', icon: '🌐' },
  img: { cls: 'file-img', icon: '🖼' },
  generic: { cls: 'file-generic', icon: '📄' },
};

function getFileIcon(entry) {
  if (entry.type === 'folder') {
    return stateFiles.expandedFolders.has(entry._path) ? fileIcons.folder_open : fileIcons.folder;
  }
  return fileIcons[entry.ext] || fileIcons.generic;
}

async function loadFileTree(dirPath) {
  const tree = document.getElementById('file-tree');
  const dir = dirPath || stateFiles.currentDir;

  try {
    const result = await window.electronAPI.listDir(dir);
    if (result.error) {
      tree.innerHTML = `<div style="padding:16px;color:var(--danger);font-size:12px;">❌ ${escapeHtml(result.error)}</div>`;
      return;
    }
    renderFileTree(result, dir);
    document.getElementById('dir-path-display').textContent = dir;
    stateFiles.currentDir = dir;
  } catch (err) {
    tree.innerHTML = `<div style="padding:16px;color:var(--danger);font-size:12px;">加载失败: ${escapeHtml(err.message)}</div>`;
  }
}

function renderFileTree(entries, basePath) {
  const tree = document.getElementById('file-tree');
  // Sort: folders first, then alphabetical
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Assign full paths
  entries.forEach(e => { e._path = basePath + '\\' + e.name; });

  tree.innerHTML = buildTreeHtml(entries, 0);
  attachTreeEvents();
}

function buildTreeHtml(entries, depth) {
  let html = '';
  entries.forEach(entry => {
    const ico = getFileIcon(entry);
    const indent = depth * 16;

    if (entry.type === 'folder') {
      const isExpanded = stateFiles.expandedFolders.has(entry._path);
      html += `<div class="tree-entry folder-entry" data-path="${escapeAttr(entry._path)}" data-type="folder">
        <span class="tree-indent" style="width:${indent}px"></span>
        <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">▶</span>
        <span class="tree-icon ${ico.cls}">${ico.icon}</span>
        <span class="tree-name">${escapeHtml(entry.name)}</span>
      </div>`;
      if (isExpanded && entry._children) {
        html += buildTreeHtml(entry._children, depth + 1);
      }
    } else {
      html += `<div class="tree-entry file-entry" data-path="${escapeAttr(entry._path)}" data-type="file" draggable="true">
        <span class="tree-indent" style="width:${indent}px"></span>
        <span class="tree-toggle placeholder">▶</span>
        <span class="tree-icon ${ico.cls}">${ico.icon}</span>
        <span class="tree-name">${escapeHtml(entry.name)}</span>
      </div>`;
    }
  });
  return html;
}

async function toggleFolder(pathEl, path) {
  if (stateFiles.expandedFolders.has(path)) {
    stateFiles.expandedFolders.delete(path);
    // Re-render from root
    const entries = await window.electronAPI.listDir(stateFiles.currentDir);
    if (!entries.error) loadAndExpandChildren(entries, stateFiles.currentDir);
  } else {
    stateFiles.expandedFolders.add(path);
    // Load children and re-render
    try {
      const children = await window.electronAPI.listDir(path);
      if (!children.error) {
        // Attach children to the parent entry in our tree cache
        setChildren(stateFiles.currentDir, path, children);
      }
    } catch (_) {}
    const entries = await window.electronAPI.listDir(stateFiles.currentDir);
    if (!entries.error) loadAndExpandChildren(entries, stateFiles.currentDir);
  }
}

// Simple recursive function: load expanded folders
async function loadAndExpandChildren(entries, basePath) {
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  entries.forEach(e => { e._path = basePath + '\\' + e.name; });

  for (const entry of entries) {
    if (entry.type === 'folder' && stateFiles.expandedFolders.has(entry._path)) {
      try {
        const children = await window.electronAPI.listDir(entry._path);
        if (!children.error) {
          entry._children = children;
          await loadAndExpandChildren(children, entry._path);
        }
      } catch (_) {}
    }
  }

  const tree = document.getElementById('file-tree');
  tree.innerHTML = buildTreeHtml(entries, 0);
  attachTreeEvents();
}

// Cache helper: walk entries to set children for a specific path
function setChildren(basePath, targetPath, children) {
  // This is a simplified version — for now we use loadAndExpandChildren
}

function attachTreeEvents() {
  const tree = document.getElementById('file-tree');

  // Drag handlers for file entries
  tree.querySelectorAll('.file-entry[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      const path = el.dataset.path;
      const name = path.split('\\').pop();
      e.dataTransfer.setData('text/plain', path);
      e.dataTransfer.effectAllowed = 'copy';
      el.classList.add('dragging');
      dragGhost.textContent = '📎 ' + name;
      dragGhost.classList.add('active');
      e.dataTransfer.setDragImage(dragGhost, 0, 0);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      dragGhost.classList.remove('active');
    });
  });

  tree.querySelectorAll('.tree-toggle:not(.placeholder)').forEach(toggle => {
    toggle.addEventListener('click', async (e) => {
      e.stopPropagation();
      const entryEl = toggle.closest('.tree-entry');
      const path = entryEl.dataset.path;
      await toggleFolder(entryEl, path);
    });
  });

  tree.querySelectorAll('.file-entry').forEach(el => {
    el.addEventListener('click', () => {
      tree.querySelectorAll('.tree-entry').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      openFileInPreview(el.dataset.path);
    });
  });
}

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Refresh button
document.getElementById('btn-refresh-dir').addEventListener('click', () => {
  stateFiles.expandedFolders.clear();
  loadFileTree();
});

// Select directory button (placeholder — full dialog in Phase 2)
document.getElementById('btn-select-dir').addEventListener('click', () => {
  const newPath = prompt('输入工作目录路径:', stateFiles.currentDir);
  if (newPath) {
    stateFiles.expandedFolders.clear();
    loadFileTree(newPath);
  }
});

// ═══════ PREVIEW PANEL ═══════
const previewPanel = document.getElementById('preview-panel');
const previewHeader = document.getElementById('preview-header');
const previewBody = document.getElementById('preview-body');
const previewEmpty = document.getElementById('preview-empty');
const btnClosePanel = document.getElementById('btn-close-panel');
const resizeHandle = document.getElementById('preview-resize');

const PREVIEW_DEFAULTS = { width: 420, minW: 280, maxRatio: 0.5 };
let previewOpenFiles = [];     // [{ path, name, ext }]
let previewActivePath = null;
let previewWidth = PREVIEW_DEFAULTS.width;
const previewFileContents = {};  // path → raw content
const previewViewModes = {};     // path → 'preview' | 'source'

async function openFileInPreview(path) {
  const name = path.split('\\').pop();
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

  const existing = previewOpenFiles.find(f => f.path === path);
  if (existing) { switchPreviewTab(path); return; }

  previewOpenFiles.push({ path, name, ext });
  switchPreviewTab(path);
  renderPreviewTabs();
  openPreviewPanel();
}

function switchPreviewTab(path) {
  previewActivePath = path;
  renderPreviewTabs();
  renderPreviewContent(path);
}

function closePreviewTab(path, e) {
  if (e) e.stopPropagation();
  const idx = previewOpenFiles.findIndex(f => f.path === path);
  if (idx === -1) return;
  delete previewFileContents[path];
  delete previewViewModes[path];
  previewOpenFiles.splice(idx, 1);
  if (previewOpenFiles.length === 0) {
    previewActivePath = null; closePreviewPanel(); return;
  }
  if (previewActivePath === path) {
    previewActivePath = previewOpenFiles[Math.max(0, idx - 1)].path;
    renderPreviewContent(previewActivePath);
  }
  renderPreviewTabs();
}

function renderPreviewTabs() {
  const existingTabs = previewHeader.querySelectorAll('.preview-tab');
  existingTabs.forEach(t => t.remove());
  const actionsDiv = previewHeader.querySelector('.preview-header-actions');

  previewOpenFiles.forEach(f => {
    const isActive = f.path === previewActivePath;
    const ico = fileIcons[f.ext] || fileIcons.generic;
    const tab = document.createElement('div');
    tab.className = `preview-tab${isActive ? ' active' : ''}`;
    tab.dataset.path = f.path;
    tab.innerHTML = `<span class="tab-icon">${ico.icon}</span><span>${escapeHtml(f.name)}</span><span class="tab-close" data-close="${escapeAttr(f.path)}">×</span>`;
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) { closePreviewTab(e.target.dataset.close, e); return; }
      switchPreviewTab(f.path);
    });
    previewHeader.insertBefore(tab, actionsDiv);
  });
}

const viewBar = document.getElementById('preview-viewbar');
const viewFileType = document.getElementById('view-file-type');

async function renderPreviewContent(path) {
  if (!path) { showPreviewEmpty(); return; }

  // Determine file type for view bar
  const ext = (path.split('.').pop() || '').toLowerCase();
  const canPreview = ext === 'md' || ext === 'html' || ext === 'htm';
  viewBar.classList.toggle('visible', canPreview);
  viewFileType.textContent = ext.toUpperCase();

  // Set default view mode
  if (!(path in previewViewModes)) previewViewModes[path] = 'preview';
  updateViewModeButtons(path);

  // Fetch content if not cached
  if (!(path in previewFileContents)) {
    try {
      const result = await window.electronAPI.readFile(path);
      if (result.error) {
        previewFileContents[path] = null;
        previewBody.innerHTML = `<p style="color:var(--danger)">读取失败: ${escapeHtml(result.error)}</p>`;
        previewBody.classList.add('visible');
        previewEmpty.classList.remove('visible');
        return;
      }
      previewFileContents[path] = result.content;
    } catch (err) {
      previewFileContents[path] = null;
      previewBody.innerHTML = `<p style="color:var(--danger)">读取失败: ${escapeHtml(err.message)}</p>`;
      previewBody.classList.add('visible');
      previewEmpty.classList.remove('visible');
      return;
    }
  }

  renderWithMode(path);
  previewBody.classList.add('visible');
  previewEmpty.classList.remove('visible');
}

function renderWithMode(path) {
  const content = previewFileContents[path];
  if (content === null) return;
  const mode = previewViewModes[path] || 'preview';
  const ext = (path.split('.').pop() || '').toLowerCase();

  // Clean up any iframe from previous HTML render
  const oldIframe = previewBody.querySelector('.preview-iframe');
  if (oldIframe) oldIframe.remove();
  previewBody.innerHTML = '';

  if (mode === 'source') {
    // Source code view
    previewBody.innerHTML = `<pre class="source-view">${escapeHtml(content)}</pre>`;
  } else {
    // Preview/rendered view
    if (ext === 'md') {
      previewBody.innerHTML = renderMarkdownSafe(content);
    } else if (ext === 'html' || ext === 'htm') {
      // Sandbox in iframe to prevent CSS/JS leaking into app
      const safe = content.replace(/<script[\s\S]*?<\/script>/gi, '<!-- script removed -->');
      previewBody.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.className = 'preview-iframe';
      iframe.sandbox = 'allow-same-origin';
      iframe.srcdoc = safe;
      previewBody.appendChild(iframe);
    } else {
      previewBody.innerHTML = `<pre class="source-view">${escapeHtml(content)}</pre>`;
    }
  }
}

// Dedicated markdown renderer – handles Chinese text properly
function renderMarkdownSafe(md) {
  if (!md) return '';
  const lines = md.split('\n');
  const out = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeLang = '';
  let inList = false;
  let listItems = [];

  function flushList() {
    if (listItems.length > 0) {
      out.push('<ul>' + listItems.join('') + '</ul>');
      listItems = [];
    }
    inList = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Code block
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushList();
        codeLang = line.slice(3).trim();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    // Empty line
    if (line.trim() === '') { flushList(); out.push(''); continue; }

    // Headings
    if (/^#{1,4} /.test(line)) {
      flushList();
      const m = line.match(/^(#{1,4}) (.+)/);
      const lvl = m[1].length;
      out.push(`<h${lvl}>${inlineMarkdown(m[2])}</h${lvl}>`);
      continue;
    }

    // HR
    if (/^---$/.test(line.trim())) { flushList(); out.push('<hr>'); continue; }

    // Blockquote
    if (line.startsWith('> ')) {
      flushList();
      out.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      inList = true;
      listItems.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      inList = true;
      listItems.push(`<li>${inlineMarkdown(line.replace(/^\d+\.\s*/, ''))}</li>`);
      continue;
    }

    // Table
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      const isSep = cells.every(c => /^[-:]+$/.test(c));
      if (!isSep) {
        const isHeader = (i + 1 < lines.length && /^\|[-:\s|]+\|$/.test((lines[i + 1] || '').trim()));
        const tag = isHeader ? 'th' : 'td';
        // Collect consecutive table rows, wrap in <table> when table ends
        let tableHtml = `<tr>${cells.map(c => `<${tag}>${inlineMarkdown(c)}</${tag}>`).join('')}</tr>`;
        // Read ahead to collect all rows of this table
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (nextLine.startsWith('|') && nextLine.endsWith('|')) {
            const nextCells = nextLine.split('|').filter(c => c.trim()).map(c => c.trim());
            const nextIsSep = nextCells.every(c => /^[-:]+$/.test(c));
            if (!nextIsSep) {
              tableHtml += `<tr>${nextCells.map(c => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`;
              j++;
            } else {
              j++; // skip separator
            }
          } else {
            break;
          }
        }
        out.push(`<table>${tableHtml}</table>`);
        i = j - 1; // skip past the consumed rows
      }
      continue;
    }

    // Regular paragraph
    flushList();
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  flushList();
  if (inCodeBlock && codeLines.length > 0) {
    out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  return out.join('\n');
}

function inlineMarkdown(text) {
  let t = escapeHtml(text);
  // Bold
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  return t;
}

function updateViewModeButtons(path) {
  const mode = previewViewModes[path] || 'preview';
  viewBar.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

// View mode toggle buttons
viewBar.querySelectorAll('.view-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!previewActivePath) return;
    previewViewModes[previewActivePath] = btn.dataset.mode;
    updateViewModeButtons(previewActivePath);
    renderWithMode(previewActivePath);
  });
});

// Intercept link clicks in preview — open in system browser, not Electron
previewBody.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  e.preventDefault();
  const href = link.getAttribute('href');
  if (!href) return;
  // External URLs → system browser; internal links → navigate in file tree
  if (href.startsWith('http://') || href.startsWith('https://')) {
    window.electronAPI.openExternal(href);
  }
});

function showPreviewEmpty() {
  previewBody.classList.remove('visible');
  previewEmpty.classList.add('visible');
  viewBar.classList.remove('visible');
}

function openPreviewPanel() {
  if (!previewPanel.classList.contains('closed')) return;
  previewPanel.classList.remove('closed');
  previewPanel.style.width = previewWidth + 'px';
  previewPanel.style.minWidth = PREVIEW_DEFAULTS.minW + 'px';
}

function closePreviewPanel() {
  previewPanel.classList.add('closed');
  previewPanel.style.width = '0';
  previewPanel.style.minWidth = '0';
  renderPreviewTabs();
  showPreviewEmpty();
}

btnClosePanel.addEventListener('click', closePreviewPanel);

// Resize handle
let isResizing = false, resizeStartX = 0, resizeStartWidth = 0;
resizeHandle.addEventListener('mousedown', (e) => {
  e.preventDefault();
  isResizing = true; resizeStartX = e.clientX; resizeStartWidth = previewPanel.offsetWidth;
  resizeHandle.classList.add('active');
  document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
});
document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const cw = document.getElementById('center-wrapper');
  const maxW = cw.offsetWidth * PREVIEW_DEFAULTS.maxRatio;
  let w = resizeStartWidth + (resizeStartX - e.clientX);
  w = Math.max(PREVIEW_DEFAULTS.minW, Math.min(maxW, w));
  previewWidth = w; previewPanel.style.width = w + 'px';
});
document.addEventListener('mouseup', () => {
  if (!isResizing) return;
  isResizing = false; resizeHandle.classList.remove('active');
  document.body.style.cursor = ''; document.body.style.userSelect = '';
});

// ═══════ DRAG & DROP (file → input) ═══════
App.referencedFiles = [];
const dragGhost = document.getElementById('drag-ghost');
const refChipsContainer = document.getElementById('ref-chips');

// Wire up drop zone on input box
dom.inputBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  dom.inputBox.classList.add('drop-active');
});
dom.inputBox.addEventListener('dragleave', () => {
  dom.inputBox.classList.remove('drop-active');
});
dom.inputBox.addEventListener('drop', async (e) => {
  e.preventDefault();
  dom.inputBox.classList.remove('drop-active');
  const path = e.dataTransfer.getData('text/plain');
  if (!path) return;
  const name = path.split('\\').pop();

  // Avoid duplicate
  if (App.referencedFiles.find(f => f.path === path)) return;

  // Read file content via IPC
  let content = '';
  try {
    const result = await window.electronAPI.readFile(path);
    if (!result.error) content = result.content;
  } catch (_) {}

  App.referencedFiles.push({ path, name, content });
  renderRefChips();
});

function renderRefChips() {
  refChipsContainer.innerHTML = App.referencedFiles.map((f, i) =>
    `<span class="ref-chip" title="${escapeHtml(f.path)}">
      📎 <span class="chip-name">${escapeHtml(f.name)}</span>
      <span class="chip-remove" data-idx="${i}">×</span>
    </span>`
  ).join('');

  refChipsContainer.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      App.referencedFiles.splice(parseInt(btn.dataset.idx), 1);
      renderRefChips();
    });
  });
}

// ── Helpers ──
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Boot ──
init().catch(console.error);
