import type { MessageEntry } from './useAgent'

const CHARS_PER_FRAME = 15

/**
 * 字符逐帧渲染泵 — requestAnimationFrame 驱动
 *
 * 将 delta 文本以每帧 CHARS_PER_FRAME 个字符的速度追加到消息，
 * 实现 typewriter 效果。当前 session 的 pending chars 泵完自动停止。
 */
export function createCharPump(deps: {
  getSessionId: () => string
  pendingChars: Map<string, Map<string, string>>
  setMessages: (fn: (prev: MessageEntry[]) => MessageEntry[]) => void
  syncToCache: (sid: string, msgs: MessageEntry[]) => void
}) {
  let pumpRafId: number | null = null

  const pumpChars = () => {
    pumpRafId = null
    const sid = deps.getSessionId()
    const pending = deps.pendingChars.get(sid)
    if (!pending || pending.size === 0) return

    let hasMore = false
    deps.setMessages((prev) => {
      const next = prev.map((m) => {
        const chars = pending.get(m.messageId)
        if (!chars || chars.length === 0 || !m.partial) return m
        if (chars.length <= CHARS_PER_FRAME) {
          pending.delete(m.messageId)
          return { ...m, content: m.content + chars }
        }
        const chunk = chars.slice(0, CHARS_PER_FRAME)
        pending.set(m.messageId, chars.slice(CHARS_PER_FRAME))
        hasMore = true
        return { ...m, content: m.content + chunk }
      })
      deps.syncToCache(sid, next)
      return next
    })
    if (hasMore) {
      pumpRafId = requestAnimationFrame(pumpChars)
    }
  }

  const schedulePump = () => {
    if (pumpRafId === null) {
      pumpRafId = requestAnimationFrame(pumpChars)
    }
  }

  const cleanup = () => {
    if (pumpRafId !== null) {
      cancelAnimationFrame(pumpRafId)
      pumpRafId = null
    }
  }

  return { schedulePump, cleanup }
}
