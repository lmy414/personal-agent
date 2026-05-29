import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'

export function handleMessageSend(msg: ClientMessage, ws: WebSocket): void {
  ws.send(JSON.stringify({
    type: 'error',
    id: msg.id,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { code: 'NOT_IMPLEMENTED', message: 'Not yet implemented', recoverable: true },
  }))
}

export function handleMessageCancel(msg: ClientMessage, ws: WebSocket): void {
  // no-op
}
