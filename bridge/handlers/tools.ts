import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { getPiSession } from '../pi-session'

export async function handleToolsSet(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const payload = msg.payload as { toolNames: string[] }
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

  const previousTools = (session as any).activeToolNames as string[] | undefined
  try {
    await (session as any).setTools?.(payload.toolNames)
  } catch (err) {
    console.warn('[tools] failed to set tools:', err)
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: {
        code: 'TOOLS_SET_FAILED',
        message: err instanceof Error ? err.message : 'Failed to set tools',
        recoverable: true,
      },
    }))
    return
  }

  // 广播状态变更
  ws.send(JSON.stringify({
    type: 'state.tools',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: {
      toolNames: payload.toolNames,
      activeToolNames: payload.toolNames,
      previousToolNames: previousTools,
      previousActiveToolNames: previousTools,
    },
  }))
}
