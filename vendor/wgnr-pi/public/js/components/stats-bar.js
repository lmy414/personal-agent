import { bus } from '../event-bus.js';
import { esc } from '../utils/markdown.js';

export class StatsBar {
  constructor(container) {
    this.container = container;
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = '';
    this.container.className = 'stats-bar';
  }

  bindEvents() {
    this.unsubs = [
      bus.on('ws:session_stats', (data) => this.updateStats(data.stats)),
      bus.on('chat:clear', () => this.clear()),
      bus.on('ws:session_reset', () => this.clear()),
    ];
  }

  updateStats(stats) {
    if (!stats) return;
    const tok = (stats.tokens?.total || 0).toLocaleString();
    const cost = stats.cost ? `$${stats.cost.toFixed(4)}` : '';
    const ctx = stats.contextUsage?.percent != null ? `ctx ${Math.round(stats.contextUsage.percent)}%` : '';
    const msgCount = stats.userMessages != null
      ? `${stats.userMessages + (stats.assistantMessages || 0)} 条消息`
      : '';
    const parts = [tok ? `🔤 ${tok} tok` : '', cost, ctx, msgCount].filter(Boolean);
    this.container.innerHTML = parts.map(p => `<span>${esc(p)}</span>`).join('·');
    this.container.classList.toggle('visible', parts.length > 0);
  }

  clear() {
    this.container.innerHTML = '';
    this.container.classList.remove('visible');
  }

  destroy() {
    this.unsubs.forEach(fn => fn());
    this.container.innerHTML = '';
  }
}
