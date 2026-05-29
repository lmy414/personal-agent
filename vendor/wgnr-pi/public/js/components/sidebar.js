import { bus } from '../event-bus.js';
import { wsService } from '../services/ws-service.js';
import { esc } from '../utils/markdown.js';

export class Sidebar {
  constructor(container) {
    this.container = container;
    this.sessions = [];
    this.activeFile = null;
    this.sidebarOpen = true;
    this.archivedOpen = false;

    this.render();
    this.bindEvents();
    this.loadSessions();
  }

  render() {
    this.container.innerHTML = `
      <button id="btn-new-chat">+ 新建会话</button>
      <div id="session-list"></div>
      <div id="archived-section">
        <button id="archived-toggle">归档 ▸</button>
        <div id="archived-list" class="collapsed"></div>
      </div>
    `;

    this.sessionList = this.container.querySelector('#session-list');
    this.archivedToggle = this.container.querySelector('#archived-toggle');
    this.archivedList = this.container.querySelector('#archived-list');

    this.container.querySelector('#btn-new-chat').onclick = () => wsService.newSession();
    this.archivedToggle.onclick = () => this.toggleArchived();
  }

  bindEvents() {
    this.unsubs = [
      bus.on('ws:session_state', (data) => {
        if (data.sessionFile) {
          this.activeFile = data.sessionFile;
          this.highlightActive();
        }
      }),
      bus.on('ws:session_switched', () => this.loadSessions()),
      bus.on('ws:agent_end', () => setTimeout(() => this.loadSessions(), 800)),
      bus.on('sidebar:toggle', () => this.toggle()),
    ];

    window.addEventListener('resize', () => this.applyState());
  }

  async loadSessions() {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      const active = data.currentFile || this.activeFile;
      if (data.currentFile) this.activeFile = data.currentFile;

      let sessions = data.sessions || [];
      try {
        const cached = JSON.parse(localStorage.getItem('pa_ss') || '[]');
        const m = new Map(cached.map(s => [s.file, s]));
        sessions.forEach(s => m.set(s.file, s));
        sessions = [...m.values()].sort((a, b) =>
          new Date(b.lastTimestamp) - new Date(a.lastTimestamp)
        );
        localStorage.setItem('pa_ss', JSON.stringify(sessions));
      } catch (e) {
        console.error('[Sidebar] merge error:', e);
      }

      this.sessions = sessions;
      this.renderList(sessions, active);
    } catch (e) {
      console.error('[Sidebar] load error:', e);
    }
  }

  renderList(sessions, activeFile) {
    const groups = this.groupByDate(sessions.filter(s => !s.archived));
    this.sessionList.innerHTML = Object.entries(groups).map(([date, items]) => `
      <div class="session-group">
        <div class="group-label">${esc(date)}</div>
        ${items.map(s => `
          <div class="session-item ${s.file === activeFile ? 'active' : ''}" data-file="${esc(s.file)}">
            ${esc(s.preview || s.file)}
          </div>
        `).join('')}
      </div>
    `).join('');

    this.sessionList.querySelectorAll('.session-item').forEach(item => {
      item.onclick = () => {
        const file = item.dataset.file;
        wsService.switchSession(file);
        bus.emit('session:switch', { file });
      };
    });
  }

  groupByDate(sessions) {
    const groups = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const s of sessions) {
      const d = new Date(s.lastTimestamp);
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diff = Math.floor((today - day) / (1000 * 60 * 60 * 24));

      let label;
      if (diff === 0) label = '今天';
      else if (diff === 1) label = '昨天';
      else if (diff < 7) label = `${diff} 天前`;
      else label = `${d.getMonth() + 1}月${d.getDate()}日`;

      if (!groups[label]) groups[label] = [];
      groups[label].push(s);
    }
    return groups;
  }

  highlightActive() {
    this.sessionList.querySelectorAll('.session-item').forEach(item => {
      item.classList.toggle('active', item.dataset.file === this.activeFile);
    });
  }

  toggle() {
    this.sidebarOpen = !this.sidebarOpen;
    this.applyState();
  }

  applyState() {
    if (window.innerWidth <= 768) {
      this.container.classList.toggle('mobile-open', this.sidebarOpen);
      document.getElementById('sidebar-overlay')?.classList.toggle('open', this.sidebarOpen);
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.toggle('hidden', !this.sidebarOpen);
      this.container.classList.remove('mobile-open');
      document.getElementById('sidebar-overlay')?.classList.remove('open');
    }
  }

  async toggleArchived() {
    this.archivedOpen = !this.archivedOpen;
    this.archivedToggle.textContent = this.archivedOpen ? '归档 ▾' : '归档 ▸';
    if (!this.archivedOpen) {
      this.archivedList.innerHTML = '';
      return;
    }
    await this.loadArchived();
  }

  async loadArchived() {
    this.archivedList.innerHTML = '<div style="padding:6px 14px;font-size:11px;color:#3d4a5c">加载中…</div>';
    try {
      const res = await fetch('/api/sessions/archived');
      const data = await res.json();
      if (!data.sessions.length) {
        this.archivedList.innerHTML = '<div style="padding:8px 14px;font-size:11px;color:#3d4a5c">无归档会话</div>';
        return;
      }
      this.archivedList.innerHTML = data.sessions.map(s => `
        <div class="archived-item">
          <span class="archived-item-title" title="${esc(s.file)}">${esc(s.preview)}</span>
          <button class="archived-restore" data-file="${esc(s.file)}">恢复</button>
        </div>
      `).join('');

      this.archivedList.querySelectorAll('.archived-restore').forEach(btn => {
        btn.onclick = async () => {
          const file = btn.dataset.file;
          const res = await fetch('/api/sessions/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file }),
          });
          const d = await res.json();
          if (d.ok) {
            await this.loadSessions();
            await this.loadArchived();
          } else {
            bus.emit('ui:notify', { type: 'error', message: `⚠ 恢复失败: ${esc(d.error || 'unknown')}` });
          }
        };
      });
    } catch (e) {
      this.archivedList.innerHTML = `<div style="padding:8px 14px;font-size:11px;color:#f87171">${esc(e.message)}</div>`;
    }
  }

  destroy() {
    this.unsubs.forEach(fn => fn());
    this.container.innerHTML = '';
  }
}
