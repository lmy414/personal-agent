import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { getAllMemories, searchMemories, type MemoryEntry } from './memory-store'

function formatEntries(entries: MemoryEntry[]): { content: string; category: string; importance: number }[] {
  return entries.map(e => ({
    content: e.content,
    category: e.source,
    importance: 3,
  }))
}

export function handleMemorySearch(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { query: string }
  const results = searchMemories(payload.query)

  ws.send(JSON.stringify({
    type: 'memory.results',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { query: payload.query, entries: formatEntries(results) },
  }))
}

export function handleMemoryList(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { limit?: number; offset?: number }
  const limit = payload.limit ?? 20
  const offset = payload.offset ?? 0

  const all = getAllMemories()
  const slice = all.slice(offset, offset + limit)

  ws.send(JSON.stringify({
    type: 'memory.list',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { entries: formatEntries(slice), total: all.length },
  }))
}
