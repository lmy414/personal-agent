import type { WebSocket } from 'ws'
import type { ClientMessage } from './protocol'
import { handleSessionCreate, handleSessionList, handleSessionSwitch, handleSessionDelete, handleSessionHistory, handleSessionRename, handleSessionState, handleSessionCompact } from './handlers/session'
import { handleMessageSend, handleMessageCancel } from './handlers/message'
import { handleModelSwitch, handleModelList } from './handlers/model'
import { handleFileList, handleFileRead } from './handlers/file'
import { handleMemorySearch, handleMemoryList } from './handlers/memory'

type Handler = (msg: ClientMessage, ws: WebSocket) => void | Promise<void>

const routes: Record<string, Handler> = {
  'session.create': handleSessionCreate,
  'session.list': handleSessionList,
  'session.switch': handleSessionSwitch,
  'session.delete': handleSessionDelete,
  'message.send': handleMessageSend,
  'message.cancel': handleMessageCancel,
  'model.switch': handleModelSwitch,
  'model.list': handleModelList,
  'file.list': handleFileList,
  'file.read': handleFileRead,
  'memory.search': handleMemorySearch,
  'memory.list': handleMemoryList,
  'session.history': handleSessionHistory,
  'session.rename': handleSessionRename,
  'session.state': handleSessionState,
  'session.compact': handleSessionCompact,
}

export function dispatch(msg: ClientMessage, ws: WebSocket): void {
  const handler = routes[msg.type]
  if (!handler) {
    ws.send(JSON.stringify({
      type: 'error',
      id: msg.id,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'UNKNOWN_TYPE', message: `Unknown message type: ${msg.type}`, recoverable: true },
    }))
    return
  }
  handler(msg, ws)
}
