class EventBus {
  constructor() {
    this.events = {};
  }
  on(event, handler) {
    (this.events[event] ||= []).push(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(h => h !== handler);
  }
  emit(event, data) {
    (this.events[event] || []).forEach(h => h(data));
  }
}
export const bus = new EventBus();
