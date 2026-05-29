import { bus } from '../event-bus.js';

export class HealthBanner {
  constructor(container) {
    this.container = container;
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = '<span id="health-msg"></span>';
    this.msgEl = this.container.querySelector('#health-msg');
  }

  bindEvents() {
    this.unsubs = [
      bus.on('health:show', (data) => this.show(data.message)),
      bus.on('health:hide', () => this.hide()),
      bus.on('ws:pi_health', (data) => {
        if (data.connected) this.hide();
        else this.show('⚠ Pi 已断开，正在重连…');
      }),
    ];
  }

  show(message) {
    this.container.classList.add('visible');
    this.msgEl.textContent = message;
  }

  hide() {
    this.container.classList.remove('visible');
  }

  destroy() {
    this.unsubs.forEach(fn => fn());
    this.container.innerHTML = '';
  }
}
