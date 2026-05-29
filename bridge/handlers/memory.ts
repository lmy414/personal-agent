import type { WebSocket } from 'ws'
import type { ClientMessage, MemoryEntry } from '../protocol'

const memories: MemoryEntry[] = [
  { content: '用户偏好 TypeScript 严格模式', category: 'preference', importance: 8 },
  { content: '项目使用 Pi 框架作为后端', category: 'technical', importance: 9 },
  { content: 'UI 风格：玻璃拟态 + 悬浮面板', category: 'design', importance: 7 },
]

export function handleMemorySearch(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { query: string }
  const query = payload.query.toLowerCase()
  const results = memories.filter((m) => m.content.toLowerCase().includes(query))

  ws.send(JSON.stringify({
    type: 'memory.results',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { query: payload.query, entries: results },
  }))
}

export function handleMemoryList(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { limit?: number; offset?: number }
  const limit = payload.limit ?? 20
  const offset = payload.offset ?? 0
  const slice = memories.slice(offset, offset + limit)

  ws.send(JSON.stringify({
    type: 'memory.list',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { entries: slice, total: memories.length },
  }))
}
