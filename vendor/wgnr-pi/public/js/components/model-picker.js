import { bus } from '../event-bus.js';
import { wsService } from '../services/ws-service.js';
import { esc } from '../utils/markdown.js';

export class ModelPicker {
  constructor(container) {
    this.container = container;
    this.allModels = [];
    this.currentModel = null;

    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div id="model-modal" class="modal-backdrop">
        <div class="modal">
          <div class="modal-header">
            <h3>选择模型</h3>
            <button class="modal-close">&times;</button>
          </div>
          <input type="text" id="model-search" placeholder="搜索模型…">
          <div id="model-list"></div>
        </div>
      </div>
    `;

    this.modal = this.container.querySelector('#model-modal');
    this.modelList = this.container.querySelector('#model-list');
    this.modelSearch = this.container.querySelector('#model-search');

    this.container.querySelector('.modal-close').onclick = () => this.close();
    this.modal.onclick = (e) => { if (e.target === this.modal) this.close(); };
    this.modelSearch.oninput = () => this.filterModels(this.modelSearch.value);
  }

  bindEvents() {
    this.unsubs = [
      bus.on('ws:available_models', (data) => {
        this.allModels = data.models || [];
        this.filterModels(this.modelSearch.value);
      }),
      bus.on('ws:model_state', (data) => {
        if (data.model) {
          this.currentModel = data.model;
          this.filterModels(this.modelSearch.value);
        }
      }),
      bus.on('ws:session_state', (data) => {
        if (data.model) {
          this.currentModel = data.model;
          this.filterModels(this.modelSearch.value);
        }
      }),
      bus.on('modal:open', (data) => {
        if (data.id === 'model-modal') this.open();
      }),
    ];
  }

  open() {
    this.modal.classList.add('open');
    this.modelSearch.value = '';
    this.filterModels('');
    wsService.getModels();
  }

  close() {
    this.modal.classList.remove('open');
  }

  filterModels(q) {
    q = (q || '').toLowerCase();
    const filtered = this.allModels.filter(m =>
      !q || m.id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q)
    );

    const byProvider = {};
    for (const m of filtered) {
      if (!byProvider[m.provider]) byProvider[m.provider] = [];
      byProvider[m.provider].push(m);
    }

    const currentId = this.currentModel?.id;
    let html = '';
    for (const [provider, models] of Object.entries(byProvider)) {
      html += `<div class="model-provider-group"><div class="model-provider-label">${esc(provider)}</div>`;
      for (const m of models) {
        const isCurrent = m.id === currentId;
        html += `<div class="model-item${isCurrent ? ' current' : ''}" data-provider="${esc(m.provider)}" data-id="${esc(m.id)}">
          <span class="model-item-name">${esc(m.name || m.id)}</span>
        </div>`;
      }
      html += '</div>';
    }

    if (!html) html = '<div style="padding:16px;color:var(--text-dim);font-size:13px">未找到模型</div>';
    this.modelList.innerHTML = html;

    this.modelList.querySelectorAll('.model-item:not(.current)').forEach(item => {
      item.onclick = () => {
        wsService.setModel(item.dataset.provider, item.dataset.id);
        this.close();
        bus.emit('ui:notify', { type: 'info', message: `正在切换到 ${esc(item.dataset.id)}…` });
      };
    });
  }

  destroy() {
    this.unsubs.forEach(fn => fn());
    this.container.innerHTML = '';
  }
}
