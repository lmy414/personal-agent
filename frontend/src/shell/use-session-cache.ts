import type { MessageEntry, ToolCallEntry } from './useAgent'
import type { StatusPayload } from '@bridge/protocol'

/**
 * 会话级缓存 — 每个 session 独立隔离的消息/工具/状态/字符缓冲
 *
 * 在 AgentProvider 中创建单例，跨 session switch 保留背景状态。
 */
export function createSessionCache() {
  const messages = new Map<string, MessageEntry[]>()
  const toolCalls = new Map<string, ToolCallEntry[]>()
  const status = new Map<string, StatusPayload>()
  const pendingChars = new Map<string, Map<string, string>>()

  const getPendingChars = (sid: string): Map<string, string> => {
    let m = pendingChars.get(sid)
    if (!m) {
      m = new Map()
      pendingChars.set(sid, m)
    }
    return m
  }

  const deleteSession = (sid: string) => {
    messages.delete(sid)
    toolCalls.delete(sid)
    pendingChars.delete(sid)
    status.delete(sid)
  }

  return {
    messages,
    toolCalls,
    status,
    pendingChars,
    getPendingChars,
    deleteSession,
  }
}

export type SessionCache = ReturnType<typeof createSessionCache>
