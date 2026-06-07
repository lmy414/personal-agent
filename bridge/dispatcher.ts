import type { WebSocket } from 'ws'
import type { ClientMessage } from './protocol'
import { handleSessionCreate, handleSessionList, handleSessionSwitch, handleSessionDelete, handleSessionHistory, handleSessionRename, handleSessionState, handleSessionCompact } from './handlers/session'
import { handleMessageSend, handleMessageCancel } from './handlers/message'
import { handleModelSwitch, handleModelList } from './handlers/model'
import { handleFileList, handleFileRead, handleFileWrite } from './handlers/file'
import { handleMemorySearch, handleMemoryList } from './handlers/memory'
import { handleSettingsGet, handleSettingsSet, handleSettingsDiscoverModels } from './handlers/settings'
import { handleSkillsList, handleSkillsInstall, handleSkillsToggle, handleSkillsRemove } from './handlers/skills'
import { handleAgentList, handleAgentCreate, handleAgentUpdate, handleAgentDelete, handleAgentSwitch, handleAgentSetDefault } from './handlers/agent'
import { handleThinkingSet } from './handlers/thinking'
import { handleToolsSet } from './handlers/tools'
import { handleProviderSave, handleProviderDelete } from './handlers/provider'
import { handleModelConfigure } from './handlers/model-config'
import { handleMcpList, handleMcpSave, handleMcpToggle, handleMcpRemove } from './handlers/mcp'
import { handleWorkdirGet, handleWorkdirSet, handleExcludeList, handleExcludeAdd, handleExcludeRemove } from './handlers/workdir'
import { handleSystemLogs } from './handlers/system-logs'

type Handler = (msg: ClientMessage, ws: WebSocket) => void | Promise<void>

// 无操作消息（心跳等），不回复 error 避免噪音
const NOOP_TYPES = new Set(['ping'])

const routes: Record<string, Handler> = {
  // ── 智能体管理 ──
  'agent.list': handleAgentList,
  'agent.create': handleAgentCreate,
  'agent.update': handleAgentUpdate,
  'agent.delete': handleAgentDelete,
  'agent.switch': handleAgentSwitch,
  'agent.set_default': handleAgentSetDefault,

  // ── 会话管理 ──
  'session.create': handleSessionCreate,
  'session.list': handleSessionList,
  'session.switch': handleSessionSwitch,
  'session.delete': handleSessionDelete,
  'session.history': handleSessionHistory,
  'session.rename': handleSessionRename,
  'session.state': handleSessionState,
  'agent.compact': handleSessionCompact,

  // ── 对话控制 ──
  'agent.prompt': handleMessageSend,
  'agent.abort': handleMessageCancel,

  // ── 模型 & 配置 ──
  'agent.model.set': handleModelSwitch,
  'agent.model.list': handleModelList,
  'agent.thinking.set': handleThinkingSet,
  'agent.tools.set': handleToolsSet,

  // ── 文件系统 ──
  'file.list': handleFileList,
  'file.read': handleFileRead,
  'file.write': handleFileWrite,

  // ── 记忆 ──
  'memory.search': handleMemorySearch,
  'memory.list': handleMemoryList,

  // ── 设置 & 技能 ──
  'settings.get': handleSettingsGet,
  'settings.set': handleSettingsSet,
  'settings.discover': handleSettingsDiscoverModels,
  'provider.save': handleProviderSave,
  'provider.delete': handleProviderDelete,
  'model.configure': handleModelConfigure,
  'skills.list': handleSkillsList,
  'skills.install': handleSkillsInstall,
  'skills.toggle': handleSkillsToggle,
  'skills.remove': handleSkillsRemove,

  // ── MCP ──
  'mcp.list': handleMcpList,
  'mcp.save': handleMcpSave,
  'mcp.toggle': handleMcpToggle,
  'mcp.remove': handleMcpRemove,

  // ── 工作目录 & 排除规则 ──
  'workdir.get': handleWorkdirGet,
  'workdir.set': handleWorkdirSet,
  'exclude.list': handleExcludeList,
  'exclude.add': handleExcludeAdd,
  'exclude.remove': handleExcludeRemove,

  // ── 系统日志 ──
  'system.logs': handleSystemLogs,
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
