/**
 * Settings Window Preload — CommonJS (Electron preload requirement).
 * Exposes minimal IPC bridge for the independent settings window.
 */
const { contextBridge, ipcRenderer } = require('electron')

const bridge = {
  /** Read persisted settings from disk */
  readSettings() {
    return ipcRenderer.invoke('settings.read')
  },
  /** Write settings to disk. Main process persists and forwards model changes to renderer. */
  writeSettings(patch) {
    return ipcRenderer.invoke('settings.write', patch)
  },
  /** Resize the main browser window */
  resizeWindow(width, height) {
    return ipcRenderer.invoke('window.resize', width, height)
  },
  /** Set main window opacity */
  setOpacity(opacity) {
    return ipcRenderer.invoke('window.opacity', opacity)
  },
}

contextBridge.exposeInMainWorld('l2dPetSettings', bridge)
