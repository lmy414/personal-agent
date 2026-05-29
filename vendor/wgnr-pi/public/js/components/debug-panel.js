import { bus } from '../event-bus.js';
import { esc } from '../utils/markdown.js';

export class DebugPanel {
  constructor(container) {
    this.container = container;
    this.observePollTimer = null;
    this.lastObserveTimestamp = 0;
    this.currentSessionId = '';

    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div id="panel-header">
        <span>流水线透视</span>
        <span class="live-indicator"></span>
        <span id="trace-turn-badge">—</span>
      </div>
      <div id="trace-list"></div>
      <div id="trace-empty" style="display:none">暂无数据</div>
    `;

    this.traceList = this.container.querySelector('#trace-list');
    this.traceEmpty = this.container.querySelector('#trace-empty');
    this.traceTurnBadge = this.container.querySelector('#trace-turn-badge');
  }

  bindEvents() {
    this.unsubs = [
      bus.on('ws:session_state', (data) => {
        if (data.sessionId) {
          this.currentSessionId = data.sessionId;
          this.lastObserveTimestamp = 0;
          if (!this.container.classList.contains('hidden')) {
            this.fetchTrace();
          }
        }
      }),
      bus.on('ws:message_start', (data) => {
        if (data.message?.role === 'custom' && data.message?.customType === 'observe_trace') {
          if (data.message.details) this.renderTrace(data.message.details);
        }
      }),
    ];

    document.getElementById('panel-toggle')?.addEventListener('click', () => this.toggle());
  }

  toggle() {
    const isOpen = !this.container.classList.contains('hidden');
    this.container.classList.toggle('hidden', isOpen);
    document.getElementById('panel-toggle')?.classList.toggle('open', !isOpen);

    if (!isOpen) {
      this.fetchTrace();
      if (!this.observePollTimer) {
        this.observePollTimer = setInterval(() => this.fetchTrace(), 3000);
      }
    } else {
      if (this.observePollTimer) {
        clearInterval(this.observePollTimer);
        this.observePollTimer = null;
      }
    }
  }

  async fetchTrace() {
    try {
      const sid = this.currentSessionId || '';
      const url = sid
        ? '/api/observe_trace?sessionId=' + encodeURIComponent(sid)
        : '/api/observe_trace';
      const res = await fetch(url);
      const data = await res.json();
      if (this.currentSessionId !== sid) return;

      if (data.timestamp > this.lastObserveTimestamp) {
        this.lastObserveTimestamp = data.timestamp;
        this.renderTrace(data);
      }
    } catch (e) {
      console.error('[observe] fetch error:', e);
    }
  }

  renderTrace(trace) {
    this.traceEmpty.style.display = 'none';
    this.traceTurnBadge.textContent = 'Turn #' + (trace.turnIndex || '?');

    const dot = this.container.querySelector('.live-indicator');
    if (dot) {
      dot.style.display = 'inline-block';
      setTimeout(() => { dot.style.display = 'none'; }, 3000);
    }

    const steps = trace.steps || [];
    if (!steps.length) {
      this.traceEmpty.style.display = '';
      this.traceTurnBadge.textContent = '—';
      this.traceList.querySelectorAll('.trace-step').forEach(el => el.remove());
      return;
    }

    const iconMap = {
      prompt: '1', context: '2', api_request: '3', api_response: '4',
      api: '3', tool: '5', counter: '6', result: '7',
    };

    let html = '';
    for (const s of steps) {
      const iconNum = iconMap[s.id] || iconMap[s.icon] || '?';
      const openClass = s.id === 'api_request' ? ' open' : '';
      html += `<div class="trace-step${openClass}">`;
      html += `<div class="trace-step-header" onclick="this.parentElement.classList.toggle('open')">`;
      html += `<div class="step-icon ${s.icon}">${iconNum}</div>`;
      html += `<div class="step-title">${esc(s.title)}</div>`;
      html += `<span class="step-badge ${s.badgeType || 'info'}">${esc(String(s.badge))}</span>`;
      html += `<span class="step-chevron">▶</span>`;
      html += '</div>';
      html += '<div class="step-body">';
      html += '<div class="step-info">';
      html += `<div class="step-subtitle">${esc(s.subtitle || '')}</div>`;

      if (s.meta && s.meta.length) {
        html += '<div class="step-meta">';
        for (const m of s.meta) {
          const cls = m.className ? ' ' + m.className : '';
          html += `<span><span class="mk">${esc(m.k)}</span> <span class="mv${cls}">${esc(m.v)}</span></span>`;
        }
        html += '</div>';
      }

      html += '</div><div class="step-detail">';

      const d = s.detail || {};
      if (d.type === 'prompt') {
        if (d.fullText) html += `<pre>${esc(d.fullText)}</pre>`;
      } else if (d.type === 'context') {
        const msgs = d.messages || [];
        let preText = '';
        for (const m of msgs) {
          preText += `[${m.role}] ${m.preview} (${m.chars} chars)\n`;
        }
        html += `<pre>${esc(preText)}</pre>`;
      } else if (d.type === 'api_request') {
        html += '<div class="kv-row"><span class="kv-key">端点</span><span class="kv-val">POST chat/completions</span></div>';
        if (d.body) html += `<pre>${esc(d.body)}</pre>`;
      } else if (d.type === 'api_response') {
        const statusColor = d.status === 200 ? '#7ec88a' : '#f87171';
        html += `<div class="kv-row"><span class="kv-key">Status</span><span class="kv-val" style="color:${statusColor}">${d.status}${d.status === 200 ? ' OK' : ''}</span></div>`;
      } else if (d.type === 'tool_calls') {
        const calls = d.calls || [];
        for (const tc of calls) {
          html += `<div class="kv-row"><span class="kv-key">Tool</span><span class="kv-val" style="color:var(--accent2)">${esc(tc.name)}</span></div>`;
          html += `<div class="kv-row"><span class="kv-key">Args</span><span class="kv-val" style="font-family:monospace;font-size:11px">${esc(tc.args)}</span></div>`;
          html += `<div class="kv-row"><span class="kv-key">耗时</span><span class="kv-val">${tc.duration}s</span></div>`;
          if (tc.result) html += `<pre>${esc(tc.result.slice(0, 600))}</pre>`;
        }
      } else if (d.type === 'counters') {
        const checks = d.checks || [];
        for (const ck of checks) {
          const barCls = ck.passed ? 'pass' : 'trigger';
          const statusCls = ck.passed ? 'pass' : 'fail';
          html += `<div class="counter-bar ${barCls}">`;
          html += `<span class="counter-name">${esc(ck.name)}</span>`;
          html += `<span class="counter-value">${esc(ck.detail)}</span>`;
          html += `<span class="counter-status ${statusCls}">${ck.passed ? '✓' : '⚠'}</span>`;
          html += '</div>';
        }
        const corrections = d.corrections || (d.correction ? [d.correction] : []);
        for (const c of corrections) {
          html += `<div class="correction-note"><span style="color:var(--accent2);font-weight:600">→ 修正槽注入：</span><span style="color:var(--text-dim)">"${esc(c)}"</span></div>`;
        }
      } else if (d.type === 'memory') {
        html += `<div style="font-size:12px;color:var(--text-dim)">${esc(d.note || '')}</div>`;
      }

      html += '</div></div></div>';
    }

    this.traceList.querySelectorAll('.trace-step').forEach(el => el.remove());
    this.traceList.insertAdjacentHTML('afterbegin', html);
  }

  destroy() {
    this.unsubs.forEach(fn => fn());
    if (this.observePollTimer) clearInterval(this.observePollTimer);
    this.container.innerHTML = '';
  }
}
