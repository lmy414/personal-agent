// ========== 消息信封 ==========

export interface MessageEnvelope<T extends string = string, P = unknown> {
  type: T
  id: string
  sessionId: string
  ts: number
  payload: P
}

// ========== 客户端 → 服务端 ==========
// 共 27 条，覆盖 Pi Agent + Harness 全部可调用方法

export type ClientMessage =
  // ── 会话管理 (7) ──
  | ClientMsg<'session.create', { model?: string; thinkingLevel?: ThinkingLevel }>
  | ClientMsg<'session.list', {}>
  | ClientMsg<'session.switch', { sessionId: string }>
  | ClientMsg<'session.delete', { sessionId: string }>
  | ClientMsg<'session.rename', { sessionId: string; title: string }>
  | ClientMsg<'session.history', { sessionId: string }>
  | ClientMsg<'session.state', {}>

  // ── 对话控制 (3) — Agent 核心方法 ──
  | ClientMsg<'agent.prompt', { content: string; displayContent?: string; attachments?: AttachmentMeta[]; images?: ImageContent[] }>
  | ClientMsg<'agent.abort', {}>
  | ClientMsg<'agent.compact', {}>

  // ── 配置控制 (4) — Agent 配置方法 ──
  | ClientMsg<'model.set', { modelId: string }>
  | ClientMsg<'model.list', {}>
  | ClientMsg<'thinking.set', { level: ThinkingLevel }>
  | ClientMsg<'tools.set', { toolNames: string[] }>

  // ── 文件系统 (3) — FileSystem 方法 ──
  | ClientMsg<'file.list', { path?: string }>
  | ClientMsg<'file.read', { path: string; encoding?: 'utf8' | 'base64' }>
  | ClientMsg<'file.write', { path: string; content: string; encoding?: 'utf8' | 'base64' }>

  // ── 设置 (3) ──
  | ClientMsg<'settings.get', {}>
  | ClientMsg<'settings.set', { key: string; value: string }>
  | ClientMsg<'settings.discover', {}>

  // ── 记忆 (2) ──
  | ClientMsg<'memory.search', { query: string }>
  | ClientMsg<'memory.list', { limit?: number; offset?: number }>

  // ── 技能 (4) ──
  | ClientMsg<'skills.list', {}>
  | ClientMsg<'skills.install', { zipPath: string; target: 'user' | 'project' }>
  | ClientMsg<'skills.toggle', { name: string; source: 'user' | 'project'; enabled: boolean }>
  | ClientMsg<'skills.remove', { name: string; source: 'user' | 'project'; dirName: string }>

  // ── 心跳 (1) ──
  | ClientMsg<'ping', {}>

type ClientMsg<T extends string, P> = MessageEnvelope<T, P>

// ========== 服务端 → 客户端 ==========
// 共 28 条，完整映射 Pi AgentEvent + AgentHarnessEvent

export type ServerMessage =
  // ── 会话 (4) ──
  | ServerMsg<'session.created', { sessionId: string; model: string; thinkingLevel: string; createdAt: number }>
  | ServerMsg<'session.list', { sessions: SessionInfo[] }>
  | ServerMsg<'session.renamed', { sessionId: string; title: string }>
  | ServerMsg<'session.deleted', { sessionId: string }>
  | ServerMsg<'session.history', {
      sessionId: string
      messages: { messageId: string; role: 'user' | 'assistant'; content: string; partial: boolean; attachments?: AttachmentMeta[] }[]
      toolCalls: ToolCallRecord[]
    }>
  | ServerMsg<'session.state', { model: string; thinkingLevel: string; contextUsed: number; contextMax: number; roundCount: number; tokens?: number; cost?: number }>

  // ── Agent 生命周期 (5) — Pi AgentEvent 直接映射 ──
  | ServerMsg<'agent.start', {}>
  | ServerMsg<'agent.end', { messages: unknown[] }>
  | ServerMsg<'turn.start', { turnIndex: number }>
  | ServerMsg<'turn.end', { turnIndex: number; usage: TokenUsage; cost: number }>
  | ServerMsg<'turn.error', { code: string; message: string; recoverable: boolean }>

  // ── 消息流 (3) — Pi message_start / message_update / message_end ──
  | ServerMsg<'message.start', { messageId: string; role: 'user' | 'assistant' }>
  | ServerMsg<'message.delta', { messageId: string; delta: string; deltaType?: 'text' | 'thinking' }>
  | ServerMsg<'message.end', { messageId: string; content: string; usage: TokenUsage }>

  // ── 工具执行 (3) — Pi tool_execution_start / _update / _end ──
  | ServerMsg<'tool.start', { toolCallId: string; toolName: string; input: Record<string, unknown> }>
  | ServerMsg<'tool.progress', { toolCallId: string; output: string }>
  | ServerMsg<'tool.end', { toolCallId: string; toolName: string; output: string; duration: number; status: 'success' | 'error'; isError: boolean }>

  // ── 状态同步 (3) — Pi model_update / thinking_level_update / tools_update ──
  | ServerMsg<'state.model', { modelId: string; provider: string; previousModelId?: string }>
  | ServerMsg<'state.thinking', { level: ThinkingLevel; previousLevel?: ThinkingLevel }>
  | ServerMsg<'state.tools', { toolNames: string[]; activeToolNames: string[]; previousToolNames?: string[]; previousActiveToolNames?: string[] }>

  // ── 聚合状态 (1) — 兼容现有 useAgent ──
  | ServerMsg<'status.update', StatusPayload>

  // ── 文件 & 文件监听 (3) ──
  | ServerMsg<'file.list', { path: string; entries: FileEntry[] }>
  | ServerMsg<'file.content', { path: string; content: string; language?: string; encoding?: 'utf8' | 'base64' }>
  | ServerMsg<'file.changed', { path: string }>

  // ── 记忆 (2) ──
  | ServerMsg<'memory.results', { query: string; entries: MemoryEntry[] }>
  | ServerMsg<'memory.list', { entries: MemoryEntry[]; total: number }>

  // ── 设置 & 技能 (3) ──
  | ServerMsg<'settings.state', { entries: { key: string; value: string }[] }>
  | ServerMsg<'skills.state', { skills: SkillSummary[]; userSkillDir: string; projectSkillDir: string }>
  | ServerMsg<'skills.installed', { name: string; source: string }>

  // ── 压缩事件 (2) — Pi session_compact / session_before_compact ──
  | ServerMsg<'session.compacted', { tokensBefore: number; tokensAfter: number; tokensSaved: number; contextWindow: number }>

  // ── 系统 (1) ──
  | ServerMsg<'error', { code: string; message: string; recoverable: boolean }>

type ServerMsg<T extends string, P> = MessageEnvelope<T, P>

// ========== 共享类型 ==========

/** Pi ThinkingLevel 枚举 */
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

/** 图片附件 */
export interface ImageContent {
  type: 'image'
  source: { type: 'base64'; media_type: string; data: string } | { type: 'url'; url: string }
}

export interface SessionInfo {
  id: string
  title: string
  lastActive: number
  roundCount: number
}

export interface TokenUsage {
  input: number
  output: number
  total: number
}

export interface StatusPayload {
  tokens: number
  cost: number
  contextUsed: number
  contextMax: number
  roundCount: number
  model?: string
  availableModels?: { id: string; name: string; contextWindow: number }[]
}

export interface FileEntry {
  name: string
  type: 'file' | 'directory'
  size?: number
}

export interface AttachmentMeta {
  path: string
  name: string
  isImage: boolean
}

export interface MemoryEntry {
  content: string
  category: string
  importance: number
}

export interface SkillSummary {
  name: string
  description: string
  source: 'user' | 'project'
  enabled: boolean
  filePath: string
  dirName: string
}

/** 工具调用持久化记录 */
export interface ToolCallRecord {
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
  output: string
  duration: number
  status: 'running' | 'success' | 'error'
}

// ========== 工具函数 ==========

/** 生成 UUID v4，Node 19+ 使用原生 crypto.randomUUID()，旧版本使用 fallback */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for Node < 19
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function createEnvelope<T extends string, P>(
  type: T,
  sessionId: string,
  payload: P
): MessageEnvelope<T, P> {
  return {
    type,
    id: generateUUID(),
    sessionId,
    ts: Date.now(),
    payload,
  }
}

export function parseMessage(raw: string): MessageEnvelope {
  return JSON.parse(raw) as MessageEnvelope
}
