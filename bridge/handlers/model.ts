import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'

export function handleModelSwitch(msg: ClientMessage, ws: WebSocket): void {
  ws.send(JSON.stringify({
    type: 'error',
    id: msg.id,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented', recoverable: true },
  }))
}

export function handleModelList(msg: ClientMessage, ws: WebSocket): void {
  ws.send(JSON.stringify({
    type: 'error',
    id: msg.id,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented', recoverable: true },
  }))
}
