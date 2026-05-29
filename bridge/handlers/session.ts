import type { WebSocket } from 'ws'
import type { ClientMessage, SessionInfo } from '../protocol'

// In-memory session store
const sessions = new Map<string, { id: string; title: string; createdAt: number; model: string }>()

export function handleSessionCreate(msg: ClientMessage, ws: WebSocket): void {
  const sessionId = msg.sessionId || `sess-${Date.now()}`
  const model = msg.payload && typeof msg.payload === 'object' && 'model' in msg.payload
    ? (msg.payload as { model?: string }).model ?? 'deepseek-v3'
    : 'deepseek-v3'

  sessions.set(sessionId, {
    id: sessionId,
    title: `新会话 ${new Date().toLocaleDateString('zh-CN')}`,
    createdAt: Date.now(),
    model,
  })

  ws.send(JSON.stringify({
    type: 'session.created',
    id: `srv-${Date.now()}`,
    sessionId,
    ts: Date.now(),
    payload: { sessionId, model, thinkingLevel: 'medium', createdAt: Date.now() },
  }))
}

export function handleSessionList(_msg: ClientMessage, ws: WebSocket): void {
  const list: SessionInfo[] = Array.from(sessions.values()).map((s) => ({
    id: s.id,
    title: s.title,
    lastActive: Date.now(),
    roundCount: 0,
  }))

  ws.send(JSON.stringify({
    type: 'session.list',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { sessions: list },
  }))
}

export function handleSessionSwitch(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { sessionId: string }
  const session = sessions.get(payload.sessionId)
  ws.send(JSON.stringify({
    type: 'session.state',
    id: `srv-${Date.now()}`,
    sessionId: payload.sessionId,
    ts: Date.now(),
    payload: {
      model: session?.model ?? 'deepseek-v3',
      thinkingLevel: 'medium',
      contextUsed: 0,
      roundCount: 0,
    },
  }))
}

export function handleSessionDelete(msg: ClientMessage, _ws: WebSocket): void {
  const payload = msg.payload as { sessionId: string }
  sessions.delete(payload.sessionId)
}
