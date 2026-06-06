import type { WebSocket } from 'ws'
import type { ClientMessage } from './protocol'
import { handleSessionCreate, handleSessionList, handleSessionSwitch, handleSessionDelete, handleSessionHistory, handleSessionRename, handleSessionState, handleSessionCompact } from './handlers/session'
import { handleMessageSend, handleMessageCancel } from './handlers/message'
import { handleModelSwitch, handleModelList } from './handlers/model'
import { handleFileList, handleFileRead } from './handlers/file'
import { handleMemorySearch, handleMemoryList } from './handlers/memory'
import { handleSettingsGet, handleSettingsSet, handleSettingsDiscoverModels } from './handlers/settings'
import { handleSkillsList, handleSkillsInstall, handleSkillsToggle, handleSkillsRemove } from './handlers/skills'

type Handler = (msg: ClientMessage, ws: WebSocket) => void | Promise<void>

// 无操作消息（心跳等），不回复 error 避免噪音
const NOOP_TYPES = new Set(['ping'])

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
  'skills.list': handleSkillsList,
  'skills.install': handleSkillsInstall,
  'skills.toggle': handleSkillsToggle,
  'skills.remove': handleSkillsRemove,
}

export function dispatch(msg: ClientMessage, ws: WebSocket): void {
  if (NOOP_TYPES.has(msg.type)) return  // 心跳等静默忽略

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
