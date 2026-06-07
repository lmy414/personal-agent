import { watch } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { WebSocket } from 'ws'
import { createClientSet } from './client-manager'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')

const DEBOUNCE_MS = 300

let watcher: ReturnType<typeof watch> | null = null
const pending = new Map<string, ReturnType<typeof setTimeout>>()

export const watcherClients = createClientSet()

function normalize(p: string): string {
  return p.replace(/\\/g, '/')
}

function broadcast(path: string) {
  const norm = normalize(path)
  watcherClients.broadcast(JSON.stringify({
    type: 'file.changed',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { path: norm },
  }))
}

export function startWatcher(): void {
  if (watcher) return

  watcher = watch(PROJECT_ROOT, { recursive: true }, (_event, filename) => {
    if (!filename) return

    // 忽略非关键目录的变化（避免 Vite HMR 导致的广播风暴）
    const norm = normalize(filename)
    if (
      norm.startsWith('node_modules/') ||
      norm.startsWith('.git/') ||
      norm.startsWith('dist/') ||
      norm.startsWith('frontend/') ||
      norm.startsWith('.claude/') ||
      norm.startsWith('vendor/')
    ) return

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

/** @deprecated use watcherClients.add() */
export const addClient = (ws: WebSocket) => watcherClients.add(ws)
/** @deprecated use watcherClients.remove() */
export const removeClient = (ws: WebSocket) => watcherClients.remove(ws)
/** @deprecated use watcherClients.broadcastExcept() */
export const broadcastToAll = (raw: string, exclude?: WebSocket) => {
  if (exclude) watcherClients.broadcastExcept(raw, exclude)
  else watcherClients.broadcast(raw)
}
