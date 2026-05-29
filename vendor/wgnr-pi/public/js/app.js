import { ChatArea } from './components/chat-area.js';
import { InputBox } from './components/input-box.js';
import { Header } from './components/header.js';
import { Sidebar } from './components/sidebar.js';
import { StatsBar } from './components/stats-bar.js';
import { HealthBanner } from './components/health-banner.js';
import { DebugPanel } from './components/debug-panel.js';
import { ModelPicker } from './components/model-picker.js';
import { bus } from './event-bus.js';
import { wsService } from './services/ws-service.js';

// Initialize all components
const app = {
  header: new Header(document.getElementById('header')),
  sidebar: new Sidebar(document.getElementById('sidebar')),
  chatArea: new ChatArea(document.getElementById('messages')),
  inputBox: new InputBox(document.getElementById('input-area')),
  statsBar: new StatsBar(document.getElementById('stats-bar')),
  healthBanner: new HealthBanner(document.getElementById('pi-health-banner')),
  debugPanel: new DebugPanel(document.getElementById('debug-panel')),
  modelPicker: new ModelPicker(document.getElementById('model-picker')),
};

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal-backdrop.open');
    if (openModal) {
      openModal.classList.remove('open');
      return;
    }
    bus.emit('cmd:hide');
    return;
  }

  const active = document.activeElement;
  if (active?.tagName === 'TEXTAREA' || active?.tagName === 'INPUT') return;

  if (e.key === 'n' && e.ctrlKey) {
    e.preventDefault();
    wsService.newSession();
  }
  if (e.key === 't' && e.ctrlKey) {
    e.preventDefault();
    bus.emit('thinking:toggle');
  }
  if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault();
    bus.emit('chat:clear');
  }
  if (e.key === '?' && !e.ctrlKey && !e.altKey) {
    bus.emit('modal:open', { id: 'help-modal' });
  }
});

// Sidebar overlay click to close
document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
  bus.emit('sidebar:close');
});

// Help modal close on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(m => {
  m.addEventListener('click', (e) => {
    if (e.target === m) m.classList.remove('open');
  });
});

// Model badge click to open model picker
document.getElementById('model-badge')?.addEventListener('click', () => {
  bus.emit('modal:open', { id: 'model-modal' });
});

// Thinking badge click to cycle thinking level
document.getElementById('thinking-badge')?.addEventListener('click', () => {
  wsService.cycleThinkingLevel();
});

// Export for debugging
window.app = app;
window.bus = bus;
