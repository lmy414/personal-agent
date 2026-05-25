/**
 * Preload script — the ONLY bridge between renderer and main process.
 * All backend communication goes through this API surface.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Settings ──
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (updates) => ipcRenderer.invoke('settings:save', updates),
  testApi: (params) => ipcRenderer.invoke('api:test', params),

  // ── Conversations ──
  listConversations: () => ipcRenderer.invoke('conversations:list'),
  createConversation: (title) => ipcRenderer.invoke('conversations:create', title),
  deleteConversation: (id) => ipcRenderer.invoke('conversations:delete', id),
  renameConversation: (id, title) => ipcRenderer.invoke('conversations:rename', id, title),
  getMessages: (conversationId) => ipcRenderer.invoke('conversations:getMessages', conversationId),

  // ── Chat ──
  sendMessage: (params) => ipcRenderer.invoke('chat:send', params),

  // ── Models ──
  listModels: (params) => ipcRenderer.invoke('models:list', params || {}),

  // ── Usage ──
  getUsageStats: (period) => ipcRenderer.invoke('usage:stats', period),
  getPricing: () => ipcRenderer.invoke('usage:pricing'),

  // ── Shell ──
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // ── File System ──
  setWorkspace: (dirPath) => ipcRenderer.invoke('fs:setWorkspace', dirPath),
  listDir: (dirPath) => ipcRenderer.invoke('fs:listDir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),

  // ── Events (main → renderer) ──
  onStreamToken: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('chat:token', handler);
    return () => ipcRenderer.removeListener('chat:token', handler);
  },
  onUsageUpdated: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('usage:updated', handler);
    return () => ipcRenderer.removeListener('usage:updated', handler);
  },
});
