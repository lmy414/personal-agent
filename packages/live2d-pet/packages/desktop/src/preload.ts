/**
 * Preload script — exposes minimal IPC bridge to renderer via contextBridge.
 *
 * Design principle: window resize, move, and PIXI rendering all happen
 * in the renderer process. Main process only creates the window,
 * runs WS/file servers, and persists settings to disk.
 */

import { contextBridge, ipcRenderer } from 'electron'

export interface L2DBridge {
  /** Send a message to the MCP adapter (via Main Process → WS) */
  send(msg: unknown): void
  /** Listen for incoming messages from MCP adapter */
  onMessage(cb: (msg: unknown) => void): () => void

  // Window control
  resizeWindow(width: number, height: number): Promise<void>
  moveWindow(x: number, y: number): Promise<void>
  getScreenBounds(): Promise<{ width: number; height: number }>

  // File system
  readDir(dirPath: string): Promise<string[]>
  readFile(filePath: string): Promise<string | null>
  setModelDir(dirPath: string): Promise<string>

  // Settings (read/write only, no side-effects)
  readSettings(): Promise<import('./settings.js').Live2DSettings>
  writeSettings(patch: Record<string, unknown>): Promise<import('./settings.js').Live2DSettings>
  openSettings(): Promise<void>
  onModelSettingsChanged(cb: (patch: Record<string, unknown>) => void): () => void
  setLocked(locked: boolean): Promise<void>
}

const bridge: L2DBridge = {
  send(msg) {
    ipcRenderer.send('send-to-mcp', msg)
  },
  onMessage(cb) {
    const handler = (_event: Electron.IpcRendererEvent, msg: unknown) => cb(msg)
    ipcRenderer.on('ws-message', handler)
    return () => ipcRenderer.removeListener('ws-message', handler)
  },

  resizeWindow(width, height) {
    return ipcRenderer.invoke('window.resize', width, height)
  },
  moveWindow(x, y) {
    return ipcRenderer.invoke('window.move', x, y)
  },
  getScreenBounds() {
    return ipcRenderer.invoke('screen.bounds')
  },

  readDir(dirPath) {
    return ipcRenderer.invoke('fs-readdir', dirPath)
  },
  readFile(filePath) {
    return ipcRenderer.invoke('fs-readfile', filePath)
  },
  setModelDir(dirPath) {
    return ipcRenderer.invoke('set-model-dir', dirPath)
  },

  readSettings() {
    return ipcRenderer.invoke('settings.read')
  },
  writeSettings(patch) {
    return ipcRenderer.invoke('settings.write', patch)
  },
  openSettings() {
    return ipcRenderer.invoke('settings.open')
  },
  onModelSettingsChanged(cb) {
    const handler = (_event: Electron.IpcRendererEvent, patch: Record<string, unknown>) => cb(patch)
    ipcRenderer.on('model-settings-changed', handler)
    return () => ipcRenderer.removeListener('model-settings-changed', handler)
  },
  setLocked(locked) {
    return ipcRenderer.invoke('window.setLocked', locked)
  },
}

contextBridge.exposeInMainWorld('l2dPet', bridge)
