import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { getPiSession, resolveModel, getAvailableModels } from '../pi-session'

export async function handleModelSwitch(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const payload = msg.payload as { modelId: string }
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

  try {
    const model = resolveModel(msg.sessionId, payload.modelId)
    await session.setModel(model)
  } catch (err) {
    console.warn(`[model] failed to switch model:`, err)
  }

  ws.send(JSON.stringify({
    type: 'session.state',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { model: payload.modelId, thinkingLevel: 'medium', contextUsed: 0, roundCount: 0 },
  }))
}

export function handleModelList(msg: ClientMessage, ws: WebSocket): void {
  const session = getPiSession(msg.sessionId)
  const models = getAvailableModels(session?.modelRegistry)

  ws.send(JSON.stringify({
    type: 'status.update',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { availableModels: models },
  } as any))
}
