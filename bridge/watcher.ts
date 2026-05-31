import { watch } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { WebSocket } from 'ws'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')

const DEBOUNCE_MS = 300

let watcher: ReturnType<typeof watch> | null = null
const clients = new Set<WebSocket>()
const pending = new Map<string, ReturnType<typeof setTimeout>>()

function normalize(p: string): string {
  return p.replace(/\\/g, '/')
}

function broadcast(path: string) {
  const norm = normalize(path)
  const msg = JSON.stringify({
    type: 'file.changed',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { path: norm },
  })
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(msg)
    }
  }
}

export function startWatcher(): void {
  if (watcher) return

  watcher = watch(PROJECT_ROOT, { recursive: true }, (_event, filename) => {
    if (!filename) return

    // 忽略 node_modules 和 .git 下的变化
    const norm = normalize(filename)
    if (norm.startsWith('node_modules/') || norm.startsWith('.git/') || norm.startsWith('dist/')) return

    // 获取变化的父目录（绝对路径）
    const absDir = dirname(norm) === '.' ? PROJECT_ROOT : resolve(PROJECT_ROOT, dirname(norm))

    // 防抖：同一目录的多次变化合并为一次推送
    const existing = pending.get(absDir)
    if (existing) clearTimeout(existing)
    pending.set(absDir, setTimeout(() => {
      pending.delete(absDir)
      broadcast(absDir)
    }, DEBOUNCE_MS))
  })

  watcher.on('error', (err) => {
    console.error('[watcher] fs.watch error:', err)
  })

  console.log('[watcher] started on', PROJECT_ROOT)
}

export function stopWatcher(): void {
  if (watcher) {
    watcher.close()
    watcher = null
    for (const t of pending.values()) clearTimeout(t)
    pending.clear()
    console.log('[watcher] stopped')
  }
}

export function addClient(ws: WebSocket): void {
  clients.add(ws)
}

export function removeClient(ws: WebSocket): void {
  clients.delete(ws)
}

export function broadcastToAll(raw: string, exclude?: WebSocket): void {
  for (const ws of clients) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(raw)
    }
  }
}
