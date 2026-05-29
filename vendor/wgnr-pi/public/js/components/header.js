import { bus } from '../event-bus.js';
import { wsService } from '../services/ws-service.js';
import { esc } from '../utils/markdown.js';

export class Header {
  constructor(container) {
    this.container = container;
    this.streaming = false;
    this.currentModel = null;
    this.currentThinkingLevel = null;
    this.piConnected = true;

    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div id="header-left">
        <button id="btn-sidebar-toggle" title="切换侧边栏">☰</button>
        <span id="dot" class=""></span>
        <span id="model-name">—</span>
        <span id="thinking-badge" style="display:none">
          <span id="thinking-level">—</span>
        </span>
      </div>
      <div id="header-right">
        <button id="btn-help" title="帮助">?</button>
        <button id="btn-export" title="导出会话">⬇</button>
        <button id="btn-clear" title="清空聊天">🗑</button>
        <button id="btn-abort" disabled>中止</button>
      </div>
    `;

    this.dot = this.container.querySelector('#dot');
    this.modelName = this.container.querySelector('#model-name');
    this.thinkingLevel = this.container.querySelector('#thinking-level');
    this.thinkingBadge = this.container.querySelector('#thinking-badge');
    this.abortBtn = this.container.querySelector('#btn-abort');
    this.sendBtn = this.container.querySelector('#btn-send');
  }

  bindEvents() {
    this.unsubs = [
      bus.on('ws:status', (data) => this.onStatus(data)),
      bus.on('ws:pi_health', (data) => this.onPiHealth(data)),
      bus.on('ws:model_state', (data) => this.onModelState(data)),
      bus.on('ws:session_state', (data) => this.onSessionState(data)),
    ];

    this.container.querySelector('#btn-sidebar-toggle').onclick = () => bus.emit('sidebar:toggle');
    this.container.querySelector('#btn-help').onclick = () => bus.emit('modal:open', { id: 'help-modal' });
    this.container.querySelector('#btn-export').onclick = () => wsService.exportRequest();
    this.container.querySelector('#btn-clear').onclick = () => bus.emit('chat:clear');
    this.container.querySelector('#btn-abort').onclick = () => wsService.abort();
  }

  onStatus(data) {
    this.streaming = data.busy;
    if (data.piConnected === false) {
      this.dot.className = '';
      this.showDisconnected();
    } else {
      this.dot.className = data.busy ? 'busy connected' : 'connected';
      this.abortBtn.disabled = !data.busy;
    }
  }

  onPiHealth(data) {
    this.piConnected = data.connected;
    if (data.connected) {
      this.dot.className = 'connected';
      this.hideDisconnected();
    } else {
      this.dot.className = '';
      this.showDisconnected();
    }
  }

  onModelState(data) {
    if (data.model) {
      this.currentModel = data.model;
      this.modelName.textContent = data.model.name || data.model.id;
    }
    if (data.thinkingLevel) {
      this.currentThinkingLevel = data.thinkingLevel;
      this.updateThinkingBadge(data.thinkingLevel);
    }
  }

  onSessionState(data) {
    if (data.model) {
      this.currentModel = data.model;
      this.modelName.textContent = data.model.name || data.model.id;
    }
    if (data.thinkingLevel) {
      this.currentThinkingLevel = data.thinkingLevel;
      this.updateThinkingBadge(data.thinkingLevel);
    }
  }

  updateThinkingBadge(level) {
    this.thinkingLevel.textContent = level || '—';
    const colors = {
      off: '#555',
      minimal: '#6a8a9a',
      low: '#7a9aba',
      medium: 'var(--accent)',
      high: 'var(--accent2)',
      xhigh: '#f87171',
    };
    this.thinkingBadge.style.color = colors[level] || 'var(--text-dim)';
    this.thinkingBadge.style.display = '';
  }

  showDisconnected() {
    bus.emit('health:show', { message: '⚠ Pi 已断开，正在重连…' });
    this.abortBtn.disabled = true;
  }

  hideDisconnected() {
    bus.emit('health:hide');
    this.abortBtn.disabled = !this.streaming;
  }

  destroy() {
    this.unsubs.forEach(fn => fn());
    this.container.innerHTML = '';
  }
}
