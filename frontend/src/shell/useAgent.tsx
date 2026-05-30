import { createContext, createSignal, onCleanup, useContext, type Component, type JSX } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { ServerMessage, StatusPayload, SessionInfo } from '@bridge/protocol'

// ========== 全局状态类型 ==========

export interface ToolCallEntry {
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
  output: string
  duration: number
  status: 'running' | 'success' | 'error'
}

export interface MessageEntry {
  messageId: string
  role: 'user' | 'assistant'
  content: string
  partial: boolean
  attachments?: { path: string; name: string; isImage: boolean }[]
}

export interface AgentState {
  connected: boolean
  sessionId: string
  messages: MessageEntry[]
  toolCalls: ToolCallEntry[]
  status: StatusPayload
  sessions: SessionInfo[]
}

interface AgentActions {
  send: (type: string, payload: unknown) => void
  createSession: (model?: string) => void
  sendMessage: (content: string, displayContent?: string, attachments?: { path: string; name: string; isImage: boolean }[]) => void
  cancelMessage: () => void
  switchSession: (sessionId: string) => void
  switchModel: (modelId: string) => void
}

export interface AgentContextValue {
  connected: () => boolean
  isStreaming: () => boolean
  sessionId: () => string
  messages: () => MessageEntry[]
  toolCalls: () => ToolCallEntry[]
  sessions: () => SessionInfo[]
  status: StatusPayload
  send: (type: string, payload: unknown) => void
  createSession: (model?: string) => void
  sendMessage: (content: string, displayContent?: string, attachments?: { path: string; name: string; isImage: boolean }[]) => void
  cancelMessage: () => void
  switchSession: (sessionId: string) => void
  switchModel: (modelId: string) => void
  subscribe: (type: ServerMessage['type'], handler: (msg: ServerMessage) => void) => (() => void)
}

// ========== Context ==========

const AgentContext = createContext<AgentContextValue>()

// ========== Provider ==========

export const AgentProvider: Component<{ sessionId: string; children: JSX.Element }> = (props) => {
  const [connected, setConnected] = createSignal(false)
  const [isStreaming, setIsStreaming] = createSignal(false)
  const [messages, setMessages] = createSignal<MessageEntry[]>([])
  const [toolCalls, setToolCalls] = createSignal<ToolCallEntry[]>([])
  const [sessions, setSessions] = createSignal<SessionInfo[]>([])
  const [currentSessionId, setCurrentSessionId] = createSignal(props.sessionId)
  const [status, setStatus] = createStore<StatusPayload>({
    tokens: 0, cost: 0, contextUsed: 0, contextMax: 0, roundCount: 0,
  })

  // session 级缓存
  const sessionMessages = new Map<string, MessageEntry[]>()
  const sessionToolCalls = new Map<string, ToolCallEntry[]>()
  const sessionStatus = new Map<string, StatusPayload>()

  // 每 session 独立的字符缓冲（逐字渲染）
  const sessionPendingChars = new Map<string, Map<string, string>>()

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let pumpRafId: number | null = null
  let reconnectAttempts = 0
  const CHARS_PER_FRAME = 2
  const pendingSends: string[] = []

  const getPendingChars = (sid: string): Map<string, string> => {
    let m = sessionPendingChars.get(sid)
    if (!m) {
      m = new Map()
      sessionPendingChars.set(sid, m)
    }
    return m
  }

  const syncSignalToCache = () => {
    const sid = currentSessionId()
    sessionMessages.set(sid, messages())
    sessionToolCalls.set(sid, toolCalls())
  }

  const connect = () => {
    ws = new WebSocket('ws://localhost:9229')

    ws.onopen = () => {
      setConnected(true)
      reconnectAttempts = 0
      // 初始化：请求 session 列表 + 模型列表
      const initMessages = [
        JSON.stringify({
          type: 'session.list', id: crypto.randomUUID(), sessionId: '', ts: Date.now(), payload: {},
        }),
        JSON.stringify({
          type: 'model.list', id: crypto.randomUUID(), sessionId: currentSessionId(), ts: Date.now(), payload: {},
        }),
      ]
      for (const raw of initMessages) {
        ws!.send(raw)
      }
      // 刷待发送队列
      while (pendingSends.length > 0) {
        const raw = pendingSends.shift()!
        ws!.send(raw)
      }
    }

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data as string)
      handleServerMessage(msg)
    }

    ws.onclose = () => {
      setConnected(false)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), 30000)
      reconnectAttempts++
      reconnectTimer = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  const pumpChars = () => {
    pumpRafId = null
    const sid = currentSessionId()
    const pending = sessionPendingChars.get(sid)
    if (!pending || pending.size === 0) return

    let hasMore = false
    setMessages((prev) => {
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
      sessionMessages.set(sid, next)
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

  const handleServerMessage = (msg: ServerMessage) => {
    const msgSid = msg.sessionId ?? ''
    const isCurrent = msgSid === currentSessionId()

    switch (msg.type) {
      // ── 对话事件：按 session 隔离 ──

      case 'message.start': {
        const entry: MessageEntry = {
          messageId: msg.payload.messageId,
          role: msg.payload.role,
          content: '',
          partial: true,
        }
        if (isCurrent) {
          setMessages((prev) => [...prev, entry])
        }
        // 更新背景 session 缓存
        const bg = sessionMessages.get(msgSid) ?? []
        sessionMessages.set(msgSid, [...bg, entry])
        break
      }

      case 'message.delta': {
        const msgId = msg.payload.messageId
        const pending = getPendingChars(msgSid)
        pending.set(msgId, (pending.get(msgId) ?? '') + msg.payload.delta)
        if (isCurrent) schedulePump()
        break
      }

      case 'message.end': {
        // 先清空该 session 的 pending chars
        const pending = sessionPendingChars.get(msgSid)
        if (pending) pending.delete(msg.payload.messageId)

        const finalize = (prev: MessageEntry[]) =>
          prev.map((m) =>
            m.messageId === msg.payload.messageId
              ? { ...m, content: msg.payload.content, partial: false }
              : m
          )

        if (isCurrent) {
          setMessages((prev) => {
            const next = finalize(prev)
            sessionMessages.set(msgSid, next)
            return next
          })
        } else {
          const bg = sessionMessages.get(msgSid)
          if (bg) sessionMessages.set(msgSid, finalize(bg))
        }
        break
      }

      // ── 工具事件：按 session 隔离 ──

      case 'tool.start': {
        const entry: ToolCallEntry = {
          toolCallId: msg.payload.toolCallId,
          toolName: msg.payload.toolName,
          input: msg.payload.input,
          output: '',
          duration: 0,
          status: 'running',
        }
        if (isCurrent) {
          setToolCalls((prev) => [...prev, entry])
        }
        const bg = sessionToolCalls.get(msgSid) ?? []
        sessionToolCalls.set(msgSid, [...bg, entry])
        break
      }

      case 'tool.progress':
        if (isCurrent) {
          setToolCalls((prev) => prev.map((t) =>
            t.toolCallId === msg.payload.toolCallId
              ? { ...t, output: t.output + msg.payload.output }
              : t
          ))
        }
        break

      case 'tool.end': {
        const finalize = (prev: ToolCallEntry[]) =>
          prev.map((t) =>
            t.toolCallId === msg.payload.toolCallId
              ? { ...t, output: msg.payload.output, duration: msg.payload.duration, status: msg.payload.status }
              : t
          )

        if (isCurrent) {
          setToolCalls((prev) => {
            const next = finalize(prev)
            sessionToolCalls.set(msgSid, next)
            return next
          })
        } else {
          const bg = sessionToolCalls.get(msgSid)
          if (bg) sessionToolCalls.set(msgSid, finalize(bg))
        }
        break
      }

      // ── turn + status ──

      case 'turn.start':
        setIsStreaming(true)
        break

      case 'turn.end':
        setIsStreaming(false)
        break

      case 'session.state': {
        const p = msg.payload as { model: string; thinkingLevel: string; contextUsed: number; contextMax: number; roundCount: number }
        setStatus('contextUsed', p.contextUsed)
        if (p.contextMax > 0) setStatus('contextMax', p.contextMax)
        setStatus('roundCount', p.roundCount)
        if (p.model) setStatus('model', p.model)
        sessionStatus.set(msgSid, {
          ...(sessionStatus.get(msgSid) ?? status),
          contextUsed: p.contextUsed,
          contextMax: p.contextMax > 0 ? p.contextMax : (sessionStatus.get(msgSid)?.contextMax ?? status.contextMax),
          roundCount: p.roundCount,
          model: p.model,
        })
        setSessions((prev) => prev.map((s) =>
          s.id === msgSid ? { ...s, roundCount: p.roundCount } : s
        ))
        break
      }

      case 'session.compacted': {
        const p = msg.payload as { tokensBefore: number; tokensAfter: number; contextWindow: number }
        setStatus('contextUsed', p.tokensAfter)
        if (p.contextWindow > 0) setStatus('contextMax', p.contextWindow)
        // 同步到 session 缓存
        const prev = sessionStatus.get(msgSid)
        sessionStatus.set(msgSid, {
          ...(prev ?? status),
          contextUsed: p.tokensAfter,
          contextMax: p.contextWindow > 0 ? p.contextWindow : (prev?.contextMax ?? status.contextMax),
        })
        break
      }

      case 'status.update':
        sessionStatus.set(msgSid, msg.payload)
        if (isCurrent) setStatus(msg.payload)
        // 同步 roundCount 到会话列表
        if (msgSid) {
          setSessions((prev) => prev.map((s) =>
            s.id === msgSid ? { ...s, roundCount: msg.payload.roundCount } : s
          ))
        }
        break

      // ── 会话管理 ──

      case 'session.created': {
        const sid = msg.payload.sessionId
        // 保存旧会话状态，切到新会话
        syncSignalToCache()
        setCurrentSessionId(sid)
        setMessages([])
        setToolCalls([])
        sessionMessages.set(sid, [])
        sessionToolCalls.set(sid, [])
        send('session.list', {})
        setSessions((prev) => {
          if (prev.some((s) => s.id === sid)) return prev
          return [...prev, {
            id: sid,
            title: `会话 ${new Date().toLocaleDateString('zh-CN')}`,
            lastActive: Date.now(),
            roundCount: 0,
          }]
        })
        break
      }

      case 'session.list': {
        const list = msg.payload.sessions as SessionInfo[]
        setSessions(list)
        if (list.length > 0 && !list.some((s) => s.id === currentSessionId())) {
          switchSession(list[0].id)
        }
        break
      }

      case 'session.history': {
        const sid = msg.payload.sessionId
        const msgs = (msg.payload.messages as any[]).map((m) => ({
          messageId: m.messageId,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          partial: m.partial ?? false,
          attachments: m.attachments ?? undefined,
        })) as MessageEntry[]
        const tcs = (msg.payload.toolCalls ?? []) as ToolCallEntry[]
        sessionMessages.set(sid, msgs)
        sessionToolCalls.set(sid, tcs)
        if (currentSessionId() === sid) {
          setMessages(msgs)
          setToolCalls(tcs)
        }
        break
      }

      case 'session.renamed':
        setSessions((prev) => prev.map((s) =>
          s.id === msg.payload.sessionId ? { ...s, title: msg.payload.title } : s
        ))
        break

      case 'session.deleted':
        setSessions((prev) => prev.filter((s) => s.id !== msg.payload.sessionId))
        sessionMessages.delete(msg.payload.sessionId)
        sessionToolCalls.delete(msg.payload.sessionId)
        sessionPendingChars.delete(msg.payload.sessionId)
        sessionStatus.delete(msg.payload.sessionId)
        break

      case 'error':
        console.error('[bridge error]', msg.payload?.code, msg.payload?.message)
        setIsStreaming(false)
        break
    }

    // dispatch to extension subscribers
    const subs = msgListeners.get(msg.type)
    if (subs) {
      subs.forEach((fn) => {
        try { fn(msg) } catch (e) { console.error('[subscribe] handler error:', e) }
      })
    }
  }

  const send = (type: string, payload: unknown) => {
    const raw = JSON.stringify({
      type,
      id: crypto.randomUUID(),
      sessionId: currentSessionId() || props.sessionId,
      ts: Date.now(),
      payload,
    })
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      pendingSends.push(raw)
      return
    }
    ws.send(raw)
  }

  const createSession = (model?: string) => send('session.create', { model })
  const sendMessage = (content: string, displayContent?: string, attachments?: { path: string; name: string; isImage: boolean }[]) => {
    const userMsg: MessageEntry = {
      messageId: `msg-${crypto.randomUUID()}`,
      role: 'user',
      content: displayContent ?? content,
      partial: false,
      attachments,
    }
    setMessages((prev) => {
      const next = [...prev, userMsg]
      sessionMessages.set(currentSessionId(), next)
      return next
    })
    send('message.send', { content, attachments })
  }
  const cancelMessage = () => send('message.cancel', {})
  const loadHistory = (sid: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      type: 'session.history',
      id: crypto.randomUUID(),
      sessionId: sid,
      ts: Date.now(),
      payload: { sessionId: sid },
    }))
  }

  const switchSession = (sid: string) => {
    // P1-07: 切换前中止当前会话的流式输出
    if (isStreaming()) {
      send('message.cancel', {})
      setIsStreaming(false)
    }
    // 先存当前 session 状态
    syncSignalToCache()
    // 保存当前状态到 sessionStatus
    sessionStatus.set(currentSessionId(), { ...status })

    setCurrentSessionId(sid)

    if (sessionMessages.has(sid)) {
      setMessages(sessionMessages.get(sid)!)
      setToolCalls(sessionToolCalls.get(sid) ?? [])
    } else {
      setMessages([])
      setToolCalls([])
    }

    // 恢复该 session 的 status
    const savedStatus = sessionStatus.get(sid)
    if (savedStatus) setStatus(savedStatus)

    // 如果有后台流式残留的 pending chars，恢复泵送
    const pending = sessionPendingChars.get(sid)
    if (pending && pending.size > 0) {
      schedulePump()
    }

    send('session.switch', { sessionId: sid })
    if (!sessionMessages.has(sid)) {
      loadHistory(sid)
    }
  }
  const switchModel = (modelId: string) => send('model.switch', { modelId })

  // ========== 扩展消息订阅 ==========

  const msgListeners = new Map<ServerMessage['type'], Set<(msg: ServerMessage) => void>>()

  const subscribe = (type: ServerMessage['type'], handler: (msg: ServerMessage) => void): (() => void) => {
    let set = msgListeners.get(type)
    if (!set) {
      set = new Set()
      msgListeners.set(type, set)
    }
    set.add(handler)
    return () => {
      set?.delete(handler)
      if (set?.size === 0) msgListeners.delete(type)
    }
  }

  connect()

  onCleanup(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (pumpRafId !== null) cancelAnimationFrame(pumpRafId)
    ws?.close()
  })

  const value: AgentContextValue = {
    connected,
    isStreaming,
    sessionId: currentSessionId,
    messages,
    toolCalls,
    sessions,
    status,
    send,
    createSession,
    sendMessage,
    cancelMessage,
    switchSession,
    switchModel,
    subscribe,
  }

  return (
    <AgentContext.Provider value={value}>
      {props.children}
    </AgentContext.Provider>
  )
}

// ========== Hook ==========

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgent must be used within AgentProvider')
  return ctx
}
