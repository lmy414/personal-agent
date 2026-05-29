import { bus } from '../event-bus.js';
import { md, esc } from '../utils/markdown.js';

export class ChatArea {
  constructor(container) {
    this.container = container;
    this.messages = [];
    this.currentAssistantEl = null;
    this.currentThinkingEl = null;
    this.currentToolCalls = {};

    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = '<div class="chat-messages"></div>';
    this.messagesEl = this.container.querySelector('.chat-messages');
  }

  bindEvents() {
    this.unsubs = [
      bus.on('ws:history', (data) => this.onHistory(data)),
      bus.on('ws:agent_start', () => this.clear()),
      bus.on('ws:session_switched', () => this.clear()),
      bus.on('ws:session_reset', () => this.clear()),
      bus.on('ws:message_start', (data) => this.onMessageStart(data)),
      bus.on('ws:message_update', (data) => this.onMessageUpdate(data)),
      bus.on('ws:message_end', () => this.onMessageEnd()),
      bus.on('ws:tool_execution_start', (data) => this.onToolStart(data)),
      bus.on('ws:tool_execution_end', (data) => this.onToolEnd(data)),
      bus.on('ws:error', (data) => this.addSystemMsg(`⚠ ${esc(data.message)}`, true)),
      bus.on('ws:export_response', (data) => this.onExportResponse(data)),
      bus.on('message:sent', (data) => this.addUserMsg(data)),
    ];
  }

  onHistory(data) {
    this.clear();
    if (!data.messages?.length) return;

    for (const m of data.messages) {
      if (m.role === 'user') {
        this.renderUserMsg(m);
      } else if (m.role === 'assistant' && m.content) {
        this.renderAssistantMsg(m);
      } else if (m.role === 'toolResult') {
        this.renderToolResult(m);
      }
    }
    this.scrollBottom();
  }

  renderUserMsg(m) {
    const c = m.content;
    const text = typeof c === 'string'
      ? c
      : (Array.isArray(c) ? c.filter(b => b.type === 'text').map(b => b.text).join('\n') : '');
    if (!text) return;

    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = `<div class="label">你</div><div class="msg-body">${md(text)}</div>`;
    this.messagesEl.appendChild(div);
  }

  renderAssistantMsg(m) {
    const text = m.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (text) {
      const div = document.createElement('div');
      div.className = 'msg assistant';
      div.innerHTML = `<div class="label">π</div><div class="msg-body">${md(text)}</div>`;
      this.messagesEl.appendChild(div);
    }

    const toolCalls = m.content.filter(b => b.type === 'toolCall');
    if (toolCalls.length) {
      const wrap = document.createElement('div');
      wrap.className = 'msg assistant';
      for (const tc of toolCalls) {
        const te = document.createElement('div');
        te.className = 'tool-call';
        const args = tc.arguments
          ? esc(typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments).slice(0, 80))
          : '';
        te.innerHTML = `<span class="tool-name">⚙ ${esc(tc.name || 'tool')}</span> <span style="color:#888">${args}</span>`;
        wrap.appendChild(te);
      }
      this.messagesEl.appendChild(wrap);
    }
  }

  renderToolResult(m) {
    const c = m.content;
    const result = typeof c === 'string'
      ? c
      : (Array.isArray(c) ? c.map(b => typeof b === 'string' ? b : (b.text || '')).join('') : '');
    const wrap = document.createElement('div');
    wrap.className = 'msg assistant';
    const te = document.createElement('div');
    te.className = 'tool-call';
    const isDir = (m.toolName === 'list_directory' || m.toolName === 'ls');
    const ws = isDir ? 'white-space:pre-wrap;' : '';
    te.innerHTML = `<span class="tool-name">⚙ ${esc(m.toolName || 'tool')}</span> <span style="color:#888;${ws}">${esc((result || '').slice(0, 500))}</span>`;
    wrap.appendChild(te);
    this.messagesEl.appendChild(wrap);
  }

  onMessageStart(data) {
    if (data.message?.role === 'custom' && data.message?.customType === 'observe_trace') {
      return;
    }
    if (data.message?.role === 'assistant') {
      this.currentAssistantEl = null;
      this.currentThinkingEl = null;
    }
  }

  onMessageUpdate(data) {
    const evt = data.assistantMessageEvent;
    if (!evt) return;

    switch (evt.type) {
      case 'text_delta': {
        const body = this.ensureAssistantMsg();
        const text = (data.message?.content || [])
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        body.innerHTML = md(text || evt.delta || '');
        this.scrollBottom();
        break;
      }
      case 'thinking_delta': {
        const body = this.ensureThinking();
        const thinkText = (data.message?.content || [])
          .filter(c => c.type === 'thinking')
          .map(c => c.thinking)
          .join('\n');
        body.textContent = thinkText || evt.delta || '';
        this.scrollBottom();
        break;
      }
      case 'thinking_start':
        this.ensureThinking();
        break;
      case 'thinking_end':
        if (this.currentThinkingEl) {
          this.currentThinkingEl.remove();
          this.currentThinkingEl = null;
        }
        break;
      case 'toolcall_start': {
        const name = (data.message?.content || [])
          .find(c => c.type === 'toolCall')?.name || '…';
        if (!this.currentToolCalls[evt.toolCallId]) {
          const body = this.ensureAssistantMsg();
          const tc = document.createElement('div');
          tc.className = 'tool-call';
          tc.dataset.id = evt.toolCallId;
          tc.innerHTML = `<span class="tool-name">${esc(name)}</span>`;
          body.appendChild(tc);
          this.currentToolCalls[evt.toolCallId] = tc;
          this.scrollBottom();
        }
        break;
      }
      case 'toolcall_end': {
        const tc = this.currentToolCalls[evt.toolCallId];
        if (tc && evt.toolCall) {
          const args = evt.toolCall.arguments;
          const preview = typeof args === 'string' ? args.slice(0, 200) : JSON.stringify(args).slice(0, 200);
          tc.innerHTML = `<span class="tool-name">${esc(evt.toolCall.name)}</span> ${esc(preview)}`;
        }
        break;
      }
    }
  }

  onMessageEnd() {
    this.currentAssistantEl = null;
    this.currentThinkingEl = null;
  }

  onToolStart(data) {
    const body = this.ensureAssistantMsg();
    const te = document.createElement('div');
    te.className = 'tool-call';
    te.innerHTML = `<span class="tool-name">⚙ ${esc(data.toolName)}</span> 执行中…`;
    body.appendChild(te);
    this.currentToolCalls[data.toolCallId] = te;
    this.scrollBottom();
  }

  onToolEnd(data) {
    const te = this.currentToolCalls[data.toolCallId];
    if (te) {
      const result = data.result?.content?.[0]?.text || '完成';
      const toolName = data.toolName || '';
      const isDir = toolName === 'list_directory' || toolName === 'ls';
      const full = esc(isDir ? result : result.slice(0, 300));
      te.innerHTML = `<span class="tool-name">⚙ ${esc(toolName)}</span> <span style="color:#888;white-space:pre-wrap">${full}</span>`;
    }
  }

  onExportResponse(data) {
    if (data.session) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const blob = new Blob([JSON.stringify(data.session, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pi-session-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.addSystemMsg('会话已导出.', true);
    }
  }

  addUserMsg(data) {
    const text = data.text;
    const images = data.images || [];

    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = `<div class="label">你</div><div class="msg-body">${md(text)}</div>`;

    if (images.length) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px';
      for (const img of images) {
        const i = document.createElement('img');
        i.src = img.dataUrl;
        i.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:6px';
        row.appendChild(i);
      }
      div.appendChild(row);
    }

    this.messagesEl.appendChild(div);
    this.scrollBottom();
  }

  addSystemMsg(content, isHtml = false) {
    const div = document.createElement('div');
    div.className = 'msg system';
    if (isHtml) div.innerHTML = content;
    else div.textContent = content;
    this.messagesEl.appendChild(div);
    this.scrollBottom();
    return div;
  }

  ensureAssistantMsg() {
    if (!this.currentAssistantEl) {
      this.currentAssistantEl = document.createElement('div');
      this.currentAssistantEl.className = 'msg assistant';
      this.currentAssistantEl.innerHTML = `<div class="label">π</div><div class="msg-body body"></div>`;
      this.messagesEl.appendChild(this.currentAssistantEl);
    }
    return this.currentAssistantEl.querySelector('.body');
  }

  ensureThinking() {
    if (!this.currentThinkingEl) {
      this.currentThinkingEl = document.createElement('div');
      this.currentThinkingEl.className = 'msg thinking';
      this.currentThinkingEl.innerHTML = `<div class="label">思考中…</div><div class="body"></div>`;
      this.messagesEl.appendChild(this.currentThinkingEl);
      this.scrollBottom();
    }
    return this.currentThinkingEl.querySelector('.body');
  }

  scrollBottom() {
    requestAnimationFrame(() => {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    });
  }

  clear() {
    this.messagesEl.innerHTML = '';
    this.currentAssistantEl = null;
    this.currentThinkingEl = null;
    this.currentToolCalls = {};
  }

  destroy() {
    this.unsubs.forEach(fn => fn());
    this.container.innerHTML = '';
  }
}
