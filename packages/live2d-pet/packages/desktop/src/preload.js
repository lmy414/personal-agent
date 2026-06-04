/**
 * Preload script — CommonJS (Electron preload requirement).
 * Exposes minimal IPC bridge to renderer via contextBridge.
 *
 * Design principle: window resize, move, and PIXI rendering all happen
 * in the renderer process. Main process only creates the window,
 * runs WS/file servers, and persists settings to disk.
 */
const { contextBridge, ipcRenderer } = require('electron')

const bridge = {
  /** Send a message to the MCP adapter (via Main Process → WS) */
  send(msg) {
    ipcRenderer.send('send-to-mcp', msg)
  },
  /** Listen for incoming messages from MCP adapter */
  onMessage(cb) {
    const handler = (_event, msg) => cb(msg)
    ipcRenderer.on('ws-message', handler)
    return () => ipcRenderer.removeListener('ws-message', handler)
  },

  // ── Window Control (Renderer-driven) ─────────────────

  /** Resize the browser window directly from renderer */
  resizeWindow(width, height) {
    return ipcRenderer.invoke('window.resize', width, height)
  },
  /** Move the browser window directly from renderer */
  moveWindow(x, y) {
    return ipcRenderer.invoke('window.move', x, y)
  },
  /** Get screen work area bounds for clamping */
  getScreenBounds() {
    return ipcRenderer.invoke('screen.bounds')
  },

  // ── File System (Main process only) ──────────────────

  /** List files in a directory */
  readDir(dirPath) {
    return ipcRenderer.invoke('fs-readdir', dirPath)
  },
  /** Read text file */
  readFile(filePath) {
    return ipcRenderer.invoke('fs-readfile', filePath)
  },
  /** Register model directory and get HTTP base URL */
  setModelDir(dirPath) {
    return ipcRenderer.invoke('set-model-dir', dirPath)
  },

  // ── Settings (read/write, no resize side-effects) ────

  /** Read persisted settings from disk */
  readSettings() {
    return ipcRenderer.invoke('settings.read')
  },
  /** Write settings to disk. Main process persists only; no window side-effects. */
  writeSettings(patch) {
    return ipcRenderer.invoke('settings.write', patch)
  },
  /** Open the independent settings window */
  openSettings() {
    return ipcRenderer.invoke('settings.open')
  },
  /** Listen for model settings changes from main process */
  onModelSettingsChanged(cb) {
    const handler = (_event, patch) => cb(patch)
    ipcRenderer.on('model-settings-changed', handler)
    return () => ipcRenderer.removeListener('model-settings-changed', handler)
  },
  /** Set window movable (false = locked, cannot drag) */
  setLocked(locked) {
    return ipcRenderer.invoke('window.setLocked', locked)
  },
}

contextBridge.exposeInMainWorld('l2dPet', bridge)
