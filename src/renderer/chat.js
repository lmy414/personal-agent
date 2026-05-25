/**
 * Chat — handles message sending, streaming, rendering.
 * Uses the global `App` state and `dom` refs from app.js.
 */

const Chat = {
  isStreaming: false,
  streamingEl: null,    // The <div class="bubble"> currently being streamed into
  streamingMsgEl: null, // The entire .msg.assistant wrapper
  currentTokens: 0,
};

/**
 * Build the messages array for the API call from current conversation context.
 */
function buildMessages() {
  const msgs = [];
  // Get visible messages from the DOM
  const msgEls = dom.chatMessages.querySelectorAll('.msg');
  msgEls.forEach(el => {
    const role = el.classList.contains('user') ? 'user' : 'assistant';
    const bubble = el.querySelector('.bubble');
    if (!bubble) return;
    // Get raw text content (strip rendered HTML for API)
    const content = bubble.textContent.trim();
    if (content) msgs.push({ role, content });
  });
  return msgs;
}

/**
 * Send user message to backend.
 */
async function sendMessage() {
  const text = dom.inputBox.value.trim();
  if (!text || Chat.isStreaming) return;
  if (!App.settings.api_key) {
    alert('请先在设置中配置 API Key。');
    Settings.open();
    return;
  }

  dom.inputBox.value = '';
  dom.inputBox.style.height = 'auto';
  dom.btnSend.disabled = true;
  dom.modelSelect.disabled = true;

  // If this is the first message, clear the empty state
  if (dom.chatMessages.querySelector('div[style*="center"]')) {
    dom.chatMessages.innerHTML = '';
  }

  // Build context from referenced files
  let fileContext = '';
  const refs = App.referencedFiles || [];
  if (refs.length > 0) {
    fileContext = '\n\n--- 以下为引用的文件内容 ---\n' +
      refs.map(f => `### ${f.name}\n\`\`\`\n${f.content || '(空文件)'}\n\`\`\``).join('\n\n') +
      '\n--- 文件内容结束 ---';
  }

  // Render user message (show text + file refs if any)
  const displayText = text + (refs.length > 0 ? '\n\n📎 已引用: ' + refs.map(f => f.name).join(', ') : '');
  Chat.renderMessage('user', displayText, 0, App.settings.default_model);

  Chat.isStreaming = true;
  Chat.currentTokens = 0;

  // Build messages from DOM (clean, no file context)
  const messages = buildMessages();

  // Clear referenced files after sending
  App.referencedFiles = [];
  if (typeof renderRefChips === 'function') renderRefChips();

  // Create streaming placeholder
  const msgEl = document.createElement('div');
  msgEl.className = 'msg assistant';
  msgEl.innerHTML = `<div class="avatar">AI</div><div><div class="bubble"></div><div class="time"></div><div class="usage-tag"></div></div>`;
  dom.chatMessages.appendChild(msgEl);
  const bubbleEl = msgEl.querySelector('.bubble');
  Chat.streamingEl = bubbleEl;
  Chat.streamingMsgEl = msgEl;

  scrollToBottom();

  try {
    // Pass fileContext separately: injected into API request, not saved to DB
    const result = await window.electronAPI.sendMessage({
      conversationId: App.currentConversationId,
      messages: messages,
      fileContext: fileContext,
      settings: App.settings,
    });

    // Replace streaming placeholder with properly rendered message
    if (Chat.streamingEl) {
      Chat.streamingMsgEl.remove();
      Chat.streamingEl = null;
      Chat.streamingMsgEl = null;
    }
    Chat.renderMessage('assistant', result.content, result.tokensInput + result.tokensOutput, result.model);

    Chat.isStreaming = false;

    // Refresh conversation list (title may have changed)
    App.conversations = await window.electronAPI.listConversations();
    renderConvList();

    // Update token display
    updateTokenDisplay();

  } catch (err) {
    if (Chat.streamingEl) {
      Chat.streamingEl.innerHTML = `<span style="color:var(--danger)">❌ 请求失败: ${escapeHtml(err.message)}</span>`;
      Chat.streamingEl = null;
      Chat.streamingMsgEl = null;
    }
    Chat.isStreaming = false;
    console.error('Chat error:', err);
  }

  dom.btnSend.disabled = false;
  dom.modelSelect.disabled = false;
  dom.inputBox.focus();
}

/**
 * Handle incoming stream token from main process.
 */
function handleStreamToken(token) {
  if (!Chat.streamingEl) return;
  Chat.streamingEl.textContent += token;
  scrollToBottom();
}

/**
 * Render a complete message bubble.
 */
function renderMessage(role, content, tokenCount, model) {
  // Remove empty state if present
  const emptyState = dom.chatMessages.querySelector('div[style*="center"]');
  if (emptyState) emptyState.remove();

  const msgEl = document.createElement('div');
  msgEl.className = `msg ${role}`;

  let bodyHtml;
  if (role === 'user') {
    bodyHtml = escapeHtml(content);
  } else {
    // Render markdown for assistant messages
    bodyHtml = renderMarkdown(content);
  }

  msgEl.innerHTML = `
    <div class="avatar">${role === 'user' ? 'U' : 'AI'}</div>
    <div>
      <div class="bubble">${bodyHtml}</div>
      <div class="time">${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
      ${tokenCount > 0 ? `<div class="usage-tag">📊 ${tokenCount} tokens${model ? ' · ' + model : ''}</div>` : ''}
    </div>`;

  dom.chatMessages.appendChild(msgEl);
  scrollToBottom();
}

/**
 * Simple Markdown → HTML (no external lib needed for basics).
 * For production, integrate marked.js.
 */
function renderMarkdown(md) {
  if (!md) return '';
  return basicMarkdown(md);
}

function basicMarkdown(md) {
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g,
    (_, lang, code) => `<pre><code>${code.trim()}</code></pre>`);
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');
  // Lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Paragraphs
  html = html.replace(/^(?!<[a-z/])(.+)$/gm, '<p>$1</p>');
  html = html.replace(/<p><\/p>/g, '');
  return html;
}

function scrollToBottom() {
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

function updateTokenDisplay() {
  // Rough estimate from the messages loaded
  let total = 0;
  dom.chatMessages.querySelectorAll('.msg').forEach(el => {
    const bubble = el.querySelector('.bubble');
    if (bubble) total += bubble.textContent.length * 0.5; // rough char→token
  });
  dom.tokenDisplay.textContent = `Tokens: ~${Math.round(total).toLocaleString()}`;
}

// Export for use in app.js
Chat.sendMessage = sendMessage;
Chat.handleStreamToken = handleStreamToken;
Chat.renderMessage = renderMessage;
Chat.scrollToBottom = scrollToBottom;
