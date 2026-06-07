import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { getDB } from '../db'
import { createClientSet } from '../client-manager'

const workdirClients = createClientSet()

function getWorkdir(): string {
  const db = getDB()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'workdir'").get() as { value: string } | undefined
  return row?.value ?? process.cwd()
}

function setWorkdir(path: string): void {
  const db = getDB()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('workdir', path)
}

function getExcludePatterns(): string[] {
  const db = getDB()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'exclude_rules'").get() as { value: string } | undefined
  if (!row?.value) return []
  try { return JSON.parse(row.value) as string[] } catch { return [] }
}

function setExcludePatterns(patterns: string[]): void {
  const db = getDB()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('exclude_rules', JSON.stringify(patterns))
}

function broadcastWorkdir(): void {
  workdirClients.broadcast(JSON.stringify({
    type: 'workdir.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { path: getWorkdir() },
  }))
}

function broadcastExclude(): void {
  workdirClients.broadcast(JSON.stringify({
    type: 'exclude.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { patterns: getExcludePatterns() },
  }))
}

export function handleWorkdirGet(_msg: ClientMessage, ws: WebSocket): void {
  workdirClients.add(ws)
  ws.send(JSON.stringify({
    type: 'workdir.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { path: getWorkdir() },
  }))
}

export function handleWorkdirSet(msg: ClientMessage, _ws: WebSocket): void {
  const { path } = msg.payload as { path: string }
  setWorkdir(path)
  broadcastWorkdir()
}

export function handleExcludeList(_msg: ClientMessage, ws: WebSocket): void {
  workdirClients.add(ws)
  ws.send(JSON.stringify({
    type: 'exclude.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { patterns: getExcludePatterns() },
  }))
}

export function handleExcludeAdd(msg: ClientMessage, _ws: WebSocket): void {
  const { pattern } = msg.payload as { pattern: string }
  const patterns = getExcludePatterns()
  if (!patterns.includes(pattern)) {
    patterns.push(pattern)
    setExcludePatterns(patterns)
  }
  broadcastExclude()
}

export function handleExcludeRemove(msg: ClientMessage, _ws: WebSocket): void {
  const { pattern } = msg.payload as { pattern: string }
  const patterns = getExcludePatterns().filter((p) => p !== pattern)
  setExcludePatterns(patterns)
  broadcastExclude()
}
