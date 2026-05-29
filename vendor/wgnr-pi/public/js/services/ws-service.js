import { bus } from '../event-bus.js';

class WsService {
  constructor() {
    this.ws = null;
    this.reconnectTimer = null;
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws`);

    this.ws.onopen = () => {
      bus.emit('ws:connected');
      this.send({ type: 'get_models' });
      this.send({ type: 'load_history' });
    };

    this.ws.onclose = () => {
      bus.emit('ws:disconnected');
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        bus.emit(`ws:${data.type}`, data);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };
  }

  send(data) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify(data));
    }
  }

  prompt(text, images) {
    this.send({ type: 'prompt', text, ...(images && { images }) });
  }
  abort() { this.send({ type: 'abort' }); }
  newSession() { this.send({ type: 'new_session' }); }
  switchSession(sessionPath) { this.send({ type: 'switch_session', sessionPath }); }
  loadHistory() { this.send({ type: 'load_history' }); }
  setModel(provider, modelId) { this.send({ type: 'set_model', provider, modelId }); }
  cycleModel() { this.send({ type: 'cycle_model' }); }
  cycleThinkingLevel() { this.send({ type: 'cycle_thinking_level' }); }
  getModels() { this.send({ type: 'get_models' }); }
  exportRequest() { this.send({ type: 'export_request' }); }
}

export const wsService = new WsService();
