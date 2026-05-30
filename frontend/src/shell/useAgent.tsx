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
  sendMessage: (content: string) => void
  cancelMessage: () => void
  switchSession: (sessionId: string) => void
  switchModel: (modelId: string) => void
}

export interface AgentContextValue {
  connected: () => boolean
  sessionId: () => string
  messages: () => MessageEntry[]
  toolCalls: () => ToolCallEntry[]
  sessions: () => SessionInfo[]
  status: StatusPayload
  send: (type: string, payload: unknown) => void
  createSession: (model?: string) => void
  sendMessage: (content: string) => void
  cancelMessage: () => void
  switchSession: (sessionId: string) => void
  switchModel: (modelId: string) => void
}

// ========== Context ==========

const AgentContext = createContext<AgentContextValue>()

// ========== Provider ==========

export const AgentProvider: Component<{ sessionId: string; children: JSX.Element }> = (props) => {
  const [connected, setConnected] = createSignal(false)
  const [messages, setMessages] = createSignal<MessageEntry[]>([])
  const [toolCalls, setToolCalls] = createSignal<ToolCallEntry[]>([])
  const [sessions, setSessions] = createSignal<SessionInfo[]>([])
  const [currentSessionId, setCurrentSessionId] = createSignal(props.sessionId)
  const [status, setStatus] = createStore<StatusPayload>({
    tokens: 0, cost: 0, contextUsed: 0, contextMax: 128000, roundCount: 0,
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
  const CHARS_PER_FRAME = 2

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
      ws!.send(JSON.stringify({
        type: 'session.list',
        id: crypto.randomUUID(),
        sessionId: '',
        ts: Date.now(),
        payload: {},
      }))
    }

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data as string)
      handleServerMessage(msg)
    }

    ws.onclose = () => {
      setConnected(false)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(connect, 3000)
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
    const msgSid = (msg as any).sessionId ?? ''
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
      case 'turn.end':
        // turn 事件不直接更新 UI，仅状态追踪
        break

      case 'session.state': {
        const p = msg.payload as { model: string; thinkingLevel: string; contextUsed: number; roundCount: number }
        setStatus({ ...status, contextUsed: p.contextUsed, roundCount: p.roundCount })
        sessionStatus.set(msgSid, { ...status, contextUsed: p.contextUsed, roundCount: p.roundCount })
        setSessions((prev) => prev.map((s) =>
          s.id === msgSid ? { ...s, roundCount: p.roundCount } : s
        ))
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
        const msgs = msg.payload.messages as MessageEntry[]
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
        break
    }
  }

  const send = (type: string, payload: unknown) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      type,
      id: crypto.randomUUID(),
      sessionId: currentSessionId() || props.sessionId,
      ts: Date.now(),
      payload,
    }))
  }

  const createSession = (model?: string) => send('session.create', { model })
  const sendMessage = (content: string) => {
    const userMsg: MessageEntry = {
      messageId: `msg-${crypto.randomUUID()}`,
      role: 'user',
      content,
      partial: false,
    }
    setMessages((prev) => {
      const next = [...prev, userMsg]
      sessionMessages.set(currentSessionId(), next)
      return next
    })
    send('message.send', { content })
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

  connect()

  onCleanup(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (pumpRafId !== null) cancelAnimationFrame(pumpRafId)
    ws?.close()
  })

  const value: AgentContextValue = {
    connected,
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
