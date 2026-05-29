import { bus } from '../event-bus.js';
import { wsService } from '../services/ws-service.js';
import { esc } from '../utils/markdown.js';

const BADGE_COLORS = { extension: '#6EA8DB', skill: '#D4AF37', prompt: '#7ec88a' };

export class InputBox {
  constructor(container) {
    this.container = container;
    this.pendingImages = [];
    this.allCommands = [];
    this.filteredCmds = [];
    this.activeCmdIndex = -1;
    this.streaming = false;
    this.currentModel = null;
    this.currentModelSupportsImages = false;

    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div id="image-previews"></div>
      <div id="input-wrap">
        <textarea id="input" placeholder="输入消息… (输入 / 查看命令)" rows="1"></textarea>
        <div id="cmd-palette" class="hidden"></div>
        <button id="attach-btn">📎</button>
        <button id="send-btn">Send</button>
      </div>
      <input type="file" id="attach-input" accept="image/*" multiple style="display:none">
    `;

    this.input = this.container.querySelector('#input');
    this.sendBtn = this.container.querySelector('#send-btn');
    this.attachBtn = this.container.querySelector('#attach-btn');
    this.attachInput = this.container.querySelector('#attach-input');
    this.imagePreviews = this.container.querySelector('#image-previews');
    this.cmdPalette = this.container.querySelector('#cmd-palette');
  }

  bindEvents() {
    this.unsubs = [
      bus.on('ws:commands', (data) => { this.allCommands = data.commands || []; }),
      bus.on('ws:status', (data) => {
        this.streaming = data.busy;
        this.sendBtn.innerHTML = data.busy ? '<span class="spinner"></span>' : 'Send';
      }),
      bus.on('ws:model_state', (data) => this.updateModel(data.model)),
      bus.on('ws:session_state', (data) => {
        if (data.model) this.updateModel(data.model);
      }),
    ];

    this.sendBtn.onclick = () => this.send();
    this.attachBtn.onclick = () => {
      if (this.currentModelSupportsImages) this.attachInput.click();
    };
    this.attachInput.onchange = async (e) => {
      await this.handleFiles(Array.from(e.target.files));
      e.target.value = '';
    };

    this.input.onkeydown = (e) => this.onKeyDown(e);
    this.input.oninput = () => this.onInput();
    this.input.onpaste = (e) => this.onPaste(e);

    document.addEventListener('click', (e) => {
      if (!this.input.contains(e.target) && !this.cmdPalette.contains(e.target)) {
        this.hideCmdPalette();
      }
    });
  }

  updateModel(model) {
    this.currentModel = model;
    this.currentModelSupportsImages = Array.isArray(model?.input) && model.input.includes('image');
    this.updateAttachBtn();
  }

  updateAttachBtn() {
    if (this.currentModelSupportsImages) {
      this.attachBtn.disabled = false;
      this.attachBtn.style.opacity = '1';
      this.attachBtn.style.cursor = 'pointer';
      this.attachBtn.title = '附加图片（或粘贴）';
    } else {
      this.attachBtn.disabled = true;
      this.attachBtn.style.opacity = '0.35';
      this.attachBtn.style.cursor = 'not-allowed';
      this.attachBtn.title = `${this.currentModel?.name || 'This model'} 不支持图片`;
      this.pendingImages = [];
      this.imagePreviews.innerHTML = '';
    }
  }

  send() {
    const text = this.input.value.trim();
    if (!text) return;
    this.hideCmdPalette();

    if (this.pendingImages.length && !this.currentModelSupportsImages) {
      bus.emit('ui:notify', {
        type: 'error',
        message: `⚠ ${esc(this.currentModel?.name || 'This model')} 不支持图片 — 仅发送文本`,
      });
      this.pendingImages = [];
      this.imagePreviews.innerHTML = '';
    }

    const images = this.pendingImages.length
      ? this.pendingImages.map(img => ({
          type: 'image',
          data: img.dataUrl.split(',')[1],
          mimeType: img.mimeType,
        }))
      : undefined;

    wsService.prompt(text, images);

    bus.emit('message:sent', { text, images: this.pendingImages });

    this.input.value = '';
    this.input.style.height = 'auto';
    this.pendingImages = [];
    this.imagePreviews.innerHTML = '';
  }

  onKeyDown(e) {
    if (this.cmdPalette.style.display !== 'none' && this.filteredCmds.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.activeCmdIndex = (this.activeCmdIndex + 1) % this.filteredCmds.length;
        this.renderCmdPalette();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.activeCmdIndex = (this.activeCmdIndex - 1 + this.filteredCmds.length) % this.filteredCmds.length;
        this.renderCmdPalette();
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && this.activeCmdIndex >= 0)) {
        e.preventDefault();
        this.selectCmd(this.activeCmdIndex);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hideCmdPalette();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.send();
    }
  }

  onInput() {
    this.input.style.height = 'auto';
    this.input.style.height = Math.min(this.input.scrollHeight, 150) + 'px';
    this.updateCmdPalette();
  }

  onPaste(e) {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) this.handleFiles([file]);
      }
    }
  }

  updateCmdPalette() {
    const val = this.input.value;
    if (!val.startsWith('/') || val.includes(' ') || !this.allCommands.length) {
      this.hideCmdPalette();
      return;
    }
    const query = val.slice(1).toLowerCase();
    this.filteredCmds = this.allCommands.filter(c =>
      c.name.toLowerCase().includes(query) || (c.description || '').toLowerCase().includes(query)
    );
    if (!this.filteredCmds.length) {
      this.hideCmdPalette();
      return;
    }
    this.activeCmdIndex = 0;
    this.renderCmdPalette();
  }

  renderCmdPalette() {
    if (!this.filteredCmds.length) {
      this.hideCmdPalette();
      return;
    }
    this.cmdPalette.style.display = 'block';
    this.cmdPalette.innerHTML = this.filteredCmds.map((c, i) => {
      const color = BADGE_COLORS[c.source] || '#888';
      return `<div class="cmd-item${i === this.activeCmdIndex ? ' active' : ''}" data-index="${i}">
        <span class="cmd-name">/${esc(c.name)}</span>
        <span class="cmd-badge" style="color:${color}">${esc(c.source)}</span>
        <span class="cmd-desc">${esc(c.description || '')}</span>
      </div>`;
    }).join('');

    this.cmdPalette.querySelectorAll('.cmd-item').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        this.selectCmd(parseInt(el.dataset.index));
      });
    });

    const active = this.cmdPalette.querySelector('.cmd-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  selectCmd(index) {
    if (index < 0 || index >= this.filteredCmds.length) return;
    this.input.value = '/' + this.filteredCmds[index].name + ' ';
    this.hideCmdPalette();
    this.input.focus();
    this.input.style.height = 'auto';
    this.input.style.height = Math.min(this.input.scrollHeight, 150) + 'px';
  }

  hideCmdPalette() {
    this.cmdPalette.style.display = 'none';
    this.filteredCmds = [];
    this.activeCmdIndex = -1;
  }

  async handleFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await this.fileToDataUrl(file);
      this.addImagePreview(dataUrl, file.type);
    }
  }

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  addImagePreview(dataUrl, mimeType) {
    this.pendingImages.push({ dataUrl, mimeType });
    const wrap = document.createElement('div');
    wrap.className = 'img-preview';
    const img = document.createElement('img');
    img.src = dataUrl;
    const btn = document.createElement('button');
    btn.className = 'img-preview-remove';
    btn.textContent = '✕';
    const idx = this.pendingImages.length - 1;
    btn.onclick = () => {
      this.pendingImages.splice(idx, 1);
      wrap.remove();
    };
    wrap.appendChild(img);
    wrap.appendChild(btn);
    this.imagePreviews.appendChild(wrap);
  }

  destroy() {
    this.unsubs.forEach(fn => fn());
    this.container.innerHTML = '';
  }
}
