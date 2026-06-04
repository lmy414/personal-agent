/**
 * Electron Main Process — Live2D Desktop Pet
 *
 * - Creates frameless transparent always-on-top window
 * - Runs WebSocket server (localhost:9228) for MCP adapter
 * - Bridges WS ↔ renderer via IPC
 *
 * Design: Renderer drives window resize/move; Main only persists settings
 * and runs services. No settings-changed round-trip.
 */

import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { WebSocketServer, WebSocket } from 'ws'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { loadSettings, updateSettings, type Live2DSettings } from './settings.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WS_PORT = 9228
const HTTP_PORT = 9230

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
const wsClients = new Set<WebSocket>()
let modelServeDir: string | null = null

// ── Screen Boundary Protection ─────────────────────

function clampToScreen(w: number, h: number, x: number, y: number) {
  const display = screen.getDisplayNearestPoint({ x, y })
  const { width: sw, height: sh } = display.workAreaSize

  // Clamp size: min 200x260, max screen size
  const cw = Math.max(200, Math.min(w, sw))
  const ch = Math.max(260, Math.min(h, sh))

  // Clamp position: keep at least 100px width + full drag handle visible
  const cx = Math.max(-cw + 100, Math.min(x, sw - 100))
  const cy = Math.max(0, Math.min(y, sh - 28))

  return { width: cw, height: ch, x: cx, y: cy }
}

// ── Window ─────────────────────────────────────────

function createWindow(settings: Live2DSettings) {
  const display = screen.getPrimaryDisplay()
  const { width: sw, height: sh } = display.workAreaSize
  const ww = settings.window.width
  const wh = settings.window.height
  const x = settings.window.x >= 0 ? settings.window.x : sw - ww - 40
  const y = settings.window.y >= 0 ? settings.window.y : sh - wh - 60

  // Clamp to screen bounds
  const clamped = clampToScreen(ww, wh, x, y)

  mainWindow = new BrowserWindow({
    width: clamped.width,
    height: clamped.height,
    x: clamped.x,
    y: clamped.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,        // allow resize from settings
    hasShadow: false,
    opacity: settings.window.opacity,
    webPreferences: {
      preload: resolve(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  mainWindow.loadFile(resolve(__dirname, 'renderer/index.html'))
  mainWindow.setVisibleOnAllWorkspaces(true)
  mainWindow.setMovable(!settings.window.locked)

  // Clamp position when dragged (native drag bypasses settings handlers)
  mainWindow.on('move', () => {
    const [x, y] = mainWindow!.getPosition()
    const [w, h] = mainWindow!.getSize()
    const clamped = clampToScreen(w, h, x, y)
    if (clamped.x !== x || clamped.y !== y) {
      mainWindow!.setPosition(clamped.x, clamped.y)
    }
  })

  // Debug: log renderer console to main process
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    const prefix = ['V', 'I', 'W', 'E'][level] ?? '?'
    console.log(`[renderer:${prefix}]`, message)
  })

  // Debug: open DevTools only with L2D_DEV=1
  if (process.env.L2D_DEV) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

// ── Settings Window ────────────────────────────────

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 280,
    height: 460,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: false,
    hasShadow: true,
    title: 'Live2D Pet 设置',
    webPreferences: {
      preload: resolve(__dirname, 'settings-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  settingsWindow.loadFile(resolve(__dirname, 'renderer/settings.html'))

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

// ── WebSocket Server (for MCP adapter) ──────────────

function startWSServer() {
  const wss = new WebSocketServer({ port: WS_PORT })

  wss.on('listening', () => {
    console.log(`[desktop] WS hub listening on ws://localhost:${WS_PORT}`)
  })

  wss.on('connection', (ws) => {
    wsClients.add(ws)
    console.log('[desktop] MCP adapter connected, readyState:', ws.readyState)

    ws.on('message', (raw) => {
      console.log('[desktop] ⬇ message event fired, typeof:', typeof raw, 'isBuffer:', Buffer.isBuffer(raw))
      try {
        const str = raw.toString()
        console.log('[desktop] ⬇ toString OK, len:', str.length)
        const msg = JSON.parse(str)
        console.log('[desktop] ⬇ parsed:', msg.type, '_rid:', msg._rid, 'keys:', Object.keys(msg).join(','))

        // Settings commands handled directly by main process
        if (msg.type === 'l2d.settings.get') {
          console.log('[desktop] 🔧 handling l2d.settings.get, ws.readyState:', ws.readyState)
          const resp = JSON.stringify({ type: 'l2d.settings.result', payload: currentSettings, _rid: msg._rid })
          ws.send(resp, (err?: Error) => {
            if (err) console.error('[desktop] ❌ ws.send(l2d.settings.result) failed:', err.message)
            else console.log('[desktop] ✅ l2d.settings.result sent OK')
          })
          return
        }
        if (msg.type === 'l2d.settings.set') {
          console.log('[desktop] 🔧 handling l2d.settings.set')
          currentSettings = updateSettings(currentSettings, msg.payload as Record<string, number | boolean>)
          if (mainWindow && !mainWindow.isDestroyed()) {
            const w = currentSettings.window
            const [cx, cy] = mainWindow.getPosition()
            const clamped = clampToScreen(w.width, w.height, w.x >= 0 ? w.x : cx, w.y >= 0 ? w.y : cy)
            mainWindow.setSize(clamped.width, clamped.height)
            mainWindow.setOpacity(w.opacity)
          }
          const resp = JSON.stringify({ type: 'l2d.settings.result', payload: currentSettings, _rid: msg._rid })
          ws.send(resp, (err?: Error) => {
            if (err) console.error('[desktop] ❌ ws.send(l2d.settings.set) failed:', err.message)
            else console.log('[desktop] ✅ l2d.settings.set result sent OK')
          })
          return
        }

        console.log('[desktop] WS → renderer:', msg.type, '_rid:', msg._rid)
        // Forward to renderer via IPC
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ws-message', msg)
        } else {
          console.log('[desktop] window not ready, dropping message')
        }
      } catch (e) {
        console.error('[desktop] ❌ message handler error:', (e as Error).message ?? e, 'raw:', typeof raw === 'string' ? (raw as string).slice(0, 100) : '[binary]')
      }
    })

    ws.on('close', () => {
      wsClients.delete(ws)
      console.log('[desktop] MCP adapter disconnected')
    })

    ws.on('error', (err) => {
      console.error('[desktop] WS client error:', err.message)
    })
  })
}

// ── IPC: File System helpers ─────────────────────────

ipcMain.handle('fs-readdir', (_event, dirPath: string) => {
  try {
    return readdirSync(dirPath)
  } catch { return [] }
})

ipcMain.handle('fs-readfile', (_event, filePath: string) => {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch { return null }
})

ipcMain.handle('set-model-dir', (_event, dirPath: string) => {
  modelServeDir = dirPath
  return `http://localhost:${HTTP_PORT}`
})

// ── IPC: Renderer → WS ──────────────────────────────

ipcMain.on('send-to-mcp', (_event, msg: any) => {
  console.log('[desktop] renderer → WS:', msg?.type, '_rid:', msg?._rid)
  const raw = JSON.stringify(msg)
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(raw)
  }
})

// ── IPC: Window Control (Renderer-driven) ────────────

ipcMain.handle('window.resize', (_event, width: number, height: number) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const [cx, cy] = mainWindow.getPosition()
  const clamped = clampToScreen(width, height, cx, cy)
  mainWindow.setSize(clamped.width, clamped.height)
})

ipcMain.handle('window.move', (_event, x: number, y: number) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const [w, h] = mainWindow.getSize()
  const clamped = clampToScreen(w, h, x, y)
  mainWindow.setPosition(clamped.x, clamped.y)
})

ipcMain.handle('window.opacity', (_event, opacity: number) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setOpacity(Math.max(0.1, Math.min(1, opacity)))
})

ipcMain.handle('window.setLocked', (_event, locked: boolean) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setMovable(!locked)
})

ipcMain.handle('screen.bounds', () => {
  const display = screen.getPrimaryDisplay()
  return display.workAreaSize
})

// ── IPC: Open Settings Window ──────────────────────

ipcMain.handle('settings.open', () => {
  createSettingsWindow()
})

// ── IPC: Settings (read/write only, no side-effects) ─

let currentSettings = loadSettings()

ipcMain.handle('settings.read', () => currentSettings)

ipcMain.handle('settings.write', (_event, patch: Record<string, unknown>) => {
  currentSettings = updateSettings(currentSettings, patch as Record<string, number | boolean>)
  // Forward model settings to renderer so it can update PIXI immediately
  const modelPatch: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) {
    if (key.startsWith('model.')) modelPatch[key] = patch[key]
  }
  if (Object.keys(modelPatch).length > 0 && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('model-settings-changed', modelPatch)
  }
  return currentSettings
})

// ── Static File Server (serves model files over HTTP) ─

function startFileServer() {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (!modelServeDir) { res.writeHead(404); res.end('no model dir set'); return }
    const urlPath = decodeURIComponent(req.url ?? '/').split('?')[0]
    let filePath = resolve(modelServeDir, urlPath.replace(/^\//, ''))
    // If request is for directory root, try to find .model3.json
    if (urlPath === '/' || urlPath === '') {
      try {
        const files = readdirSync(modelServeDir)
        const modelJson = files.find(f => f.endsWith('.model3.json'))
        if (modelJson) filePath = resolve(modelServeDir, modelJson)
      } catch {}
    }
    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }
    if (req.method === 'OPTIONS') { res.writeHead(200, headers); res.end(); return }
    if (!existsSync(filePath)) { res.writeHead(404, headers); res.end('not found'); return }
    try {
      const stat = statSync(filePath)
      if (stat.isDirectory()) {
        const files = readdirSync(filePath)
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' })
        res.end(JSON.stringify(files))
        return
      }
      const data = readFileSync(filePath)
      const ext = filePath.split('.').pop() ?? ''
      const mime: Record<string, string> = {
        json: 'application/json', png: 'image/png', jpg: 'image/jpeg',
        moc3: 'application/octet-stream', js: 'application/javascript', html: 'text/html',
      }
      res.writeHead(200, { ...headers, 'Content-Type': mime[ext] ?? 'application/octet-stream' })
      res.end(data)
    } catch (e) { console.error('[file-server]', e); res.writeHead(500, headers); res.end('read error') }
  })
  server.listen(HTTP_PORT, () => {
    console.log(`[desktop] file server on http://localhost:${HTTP_PORT}`)
  })
}

// ── App Lifecycle ───────────────────────────────────

app.whenReady().then(() => {
  const settings = loadSettings()
  createWindow(settings)
  startWSServer()
  startFileServer()
})

app.on('window-all-closed', () => {
  // Don't quit — keep running in background
})

app.on('before-quit', () => {
  for (const ws of wsClients) ws.close()
})
