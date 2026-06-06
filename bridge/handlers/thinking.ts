import type { WebSocket } from 'ws'
import type { ClientMessage, ThinkingLevel } from '../protocol'
import { getPiSession } from '../pi-session'

export async function handleThinkingSet(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const payload = msg.payload as { level: ThinkingLevel }
  const session = getPiSession(msg.sessionId)
  if (!session) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'SESSION_NOT_FOUND', message: `Session not found: ${msg.sessionId}`, recoverable: true },
    }))
    return
  }

  const previousLevel = (session as any).thinkingLevel as ThinkingLevel | undefined
  try {
    await session.setThinkingLevel(payload.level)
  } catch (err) {
    console.warn('[thinking] failed to set thinking level:', err)
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: {
        code: 'THINKING_SET_FAILED',
        message: err instanceof Error ? err.message : 'Failed to set thinking level',
        recoverable: true,
      },
    }))
    return
  }

  // 广播状态变更
  ws.send(JSON.stringify({
    type: 'state.thinking',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: {
      level: payload.level,
      previousLevel,
    },
  }))
}
