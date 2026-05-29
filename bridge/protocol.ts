// ========== 消息信封 ==========

export interface MessageEnvelope<T extends string = string, P = unknown> {
  type: T
  id: string
  sessionId: string
  ts: number
  payload: P
}

// ========== 客户端 → 服务端 ==========

export type ClientMessage =
  | ClientMsg<'session.create', { model?: string; thinkingLevel?: 'low' | 'medium' | 'high' }>
  | ClientMsg<'session.list', {}>
  | ClientMsg<'session.switch', { sessionId: string }>
  | ClientMsg<'session.delete', { sessionId: string }>
  | ClientMsg<'message.send', { content: string }>
  | ClientMsg<'message.cancel', {}>
  | ClientMsg<'model.switch', { modelId: string }>
  | ClientMsg<'model.list', {}>
  | ClientMsg<'file.list', { path?: string }>
  | ClientMsg<'file.read', { path: string }>
  | ClientMsg<'memory.search', { query: string }>
  | ClientMsg<'memory.list', { limit?: number; offset?: number }>

type ClientMsg<T extends string, P> = MessageEnvelope<T, P>

// ========== 服务端 → 客户端 ==========

export type ServerMessage =
  // 会话层
  | ServerMsg<'session.created', { sessionId: string; model: string; thinkingLevel: string; createdAt: number }>
  | ServerMsg<'session.list', { sessions: SessionInfo[] }>
  | ServerMsg<'session.state', { model: string; thinkingLevel: string; contextUsed: number; roundCount: number }>
  // 对话层
  | ServerMsg<'turn.start', { turnIndex: number }>
  | ServerMsg<'message.start', { messageId: string; role: 'user' | 'assistant' }>
  | ServerMsg<'message.delta', { messageId: string; delta: string }>
  | ServerMsg<'message.end', { messageId: string; content: string; usage: TokenUsage }>
  | ServerMsg<'turn.end', { turnIndex: number; usage: TokenUsage; cost: number }>
  // 工具层
  | ServerMsg<'tool.start', { toolCallId: string; toolName: string; input: Record<string, unknown> }>
  | ServerMsg<'tool.progress', { toolCallId: string; output: string }>
  | ServerMsg<'tool.end', { toolCallId: string; toolName: string; output: string; duration: number; status: 'success' | 'error' }>
  // 状态推送
  | ServerMsg<'status.update', StatusPayload>
  // 文件 & 记忆
  | ServerMsg<'file.list', { path: string; entries: FileEntry[] }>
  | ServerMsg<'file.content', { path: string; content: string; language?: string }>
  | ServerMsg<'memory.results', { query: string; entries: MemoryEntry[] }>
  | ServerMsg<'memory.list', { entries: MemoryEntry[]; total: number }>
  // 系统
  | ServerMsg<'compaction', { beforeTokens: number; afterTokens: number }>
  | ServerMsg<'error', { code: string; message: string; recoverable: boolean }>

type ServerMsg<T extends string, P> = MessageEnvelope<T, P>

// ========== 辅助类型 ==========

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
}

export interface FileEntry {
  name: string
  type: 'file' | 'directory'
  size?: number
}

export interface MemoryEntry {
  content: string
  category: string
  importance: number
}

// ========== 工具函数 ==========

export function createEnvelope<T extends string, P>(
  type: T,
  sessionId: string,
  payload: P
): MessageEnvelope<T, P> {
  return {
    type,
    id: crypto.randomUUID(),
    sessionId,
    ts: Date.now(),
    payload,
  }
}

export function parseMessage(raw: string): MessageEnvelope {
  return JSON.parse(raw) as MessageEnvelope
}
