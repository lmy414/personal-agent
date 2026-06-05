import type { WebSocket } from 'ws'
import type { ClientMessage } from './protocol'
import { handleSessionCreate, handleSessionList, handleSessionSwitch, handleSessionDelete, handleSessionHistory, handleSessionRename, handleSessionState, handleSessionCompact } from './handlers/session'
import { handleMessageSend, handleMessageCancel } from './handlers/message'
import { handleModelSwitch, handleModelList } from './handlers/model'
import { handleFileList, handleFileRead } from './handlers/file'
import { handleMemorySearch, handleMemoryList } from './handlers/memory'
import { handleSettingsGet, handleSettingsSet, handleSettingsDiscoverModels } from './handlers/settings'

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
  'settings.get': handleSettingsGet,
  'settings.set': handleSettingsSet,
  'settings.discover-models': handleSettingsDiscoverModels,
}

export function dispatch(msg: ClientMessage, ws: WebSocket): void {
  // 静默丢弃前端心跳 ping，避免返回 UNKNOWN_TYPE 干扰前端状态
  if ((msg as any).type === 'ping') return

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
