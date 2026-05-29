import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'

const MODELS = ['deepseek-v3', 'deepseek-r1', 'deepseek-v4-pro']

export function handleModelSwitch(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { modelId: string }
  ws.send(JSON.stringify({
    type: 'session.state',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { model: payload.modelId, thinkingLevel: 'medium', contextUsed: 0, roundCount: 0 },
  }))
}

export function handleModelList(_msg: ClientMessage, _ws: WebSocket): void {
  console.log('[bridge] available models:', MODELS.join(', '))
}
