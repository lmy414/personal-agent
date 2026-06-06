import { createContext, createEffect, createSignal, onCleanup, useContext, type Component, type JSX } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { ServerMessage, StatusPayload, SessionInfo } from '@bridge/protocol'

// ========== 常量 ==========

const WS_URL = 'ws://localhost:9229'
const HEARTBEAT_INTERVAL = 30000
const RECONNECT_BASE_DELAY = 3000
const MAX_RECONNECT_DELAY = 30000

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
  thinking: string
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
  isSettingsOpen: () => boolean
  setIsSettingsOpen: (v: boolean) => void
  settings: () => { key: string; value: string }[]
  getSettings: () => void
  setSetting: (key: string, value: string) => void
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
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false)
  const [settings, setSettings] = createSignal<{ key: string; value: string }[]>([])
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
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let pumpRafId: number | null = null
  let reconnectAttempts = 0
  const CHARS_PER_FRAME = 15
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
    ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      setConnected(true)
      setIsStreaming(false)
      reconnectAttempts = 0
      // 心跳：每 30s 发送 ping 防止静默断线
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', id: '', sessionId: '', ts: Date.now(), payload: {} }))
        }
      }, HEARTBEAT_INTERVAL)
      // 初始化：请求 session 列表 + 模型列表 + 设置
      const initMessages = [
        JSON.stringify({
          type: 'session.list', id: crypto.randomUUID(), sessionId: '', ts: Date.now(), payload: {},
        }),
        JSON.stringify({
          type: 'model.list', id: crypto.randomUUID(), sessionId: currentSessionId(), ts: Date.now(), payload: {},
        }),
        JSON.stringify({
          type: 'settings.get', id: crypto.randomUUID(), sessionId: currentSessionId(), ts: Date.now(), payload: {},
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
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
      if (reconnectTimer) clearTimeout(reconnectTimer)
      const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY)
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
          thinking: '',
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
        const dtype = (msg.payload as any).deltaType as string | undefined

        if (dtype === 'thinking') {
          // 思考内容直接追加，不需要逐字动画（默认折叠不可见）
          const appendThinking = (prev: MessageEntry[]) =>
            prev.map((m) =>
              m.messageId === msgId
                ? { ...m, thinking: m.thinking + msg.payload.delta }
                : m
            )
          if (isCurrent) {
            setMessages((prev) => {
              const next = appendThinking(prev)
              sessionMessages.set(msgSid, next)
              return next
            })
          } else {
            const bg = sessionMessages.get(msgSid)
            if (bg) sessionMessages.set(msgSid, appendThinking(bg))
          }
        } else {
          // 文本 delta → 逐字动画
          const pending = getPendingChars(msgSid)
          pending.set(msgId, (pending.get(msgId) ?? '') + msg.payload.delta)
          if (isCurrent) schedulePump()
        }
        break
      }

      case 'message.end': {
        // 先排空该消息的 pending chars，追加到当前 content，再标记完成
        const pending = sessionPendingChars.get(msgSid)
        const remaining = pending?.get(msg.payload.messageId) ?? ''
        if (pending) pending.delete(msg.payload.messageId)

        const finalize = (prev: MessageEntry[]) =>
          prev.map((m) =>
            m.messageId === msg.payload.messageId
              ? { ...m, content: m.content + remaining, partial: false }
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
        const p = msg.payload as { model: string; thinkingLevel: string; contextUsed: number; contextMax: number; roundCount: number; tokens?: number; cost?: number }
        setStatus('contextUsed', p.contextUsed)
        // 允许覆盖当前为 0 的值（首次初始化），但不允许 0 覆盖已有有效值
        if (p.contextMax > 0 || status.contextMax === 0) setStatus('contextMax', p.contextMax)
        setStatus('roundCount', p.roundCount)
        if (p.model) setStatus('model', p.model)
        if (p.tokens !== undefined) setStatus('tokens', p.tokens)
        if (p.cost !== undefined) setStatus('cost', p.cost)
        const curCtxMax = sessionStatus.get(msgSid)?.contextMax ?? status.contextMax
        sessionStatus.set(msgSid, {
          ...(sessionStatus.get(msgSid) ?? status),
          contextUsed: p.contextUsed,
          contextMax: p.contextMax > 0 || curCtxMax === 0 ? p.contextMax : curCtxMax,
          roundCount: p.roundCount,
          model: p.model,
          tokens: p.tokens ?? (sessionStatus.get(msgSid)?.tokens ?? 0),
          cost: p.cost ?? (sessionStatus.get(msgSid)?.cost ?? 0),
        })
        setSessions((prev) => prev.map((s) =>
          s.id === msgSid ? { ...s, roundCount: p.roundCount } : s
        ))
        break
      }

      case 'session.compacted': {
        const p = msg.payload as { tokensBefore: number; tokensAfter: number; tokensSaved: number; contextWindow: number }
        // 更新该 session 的缓存状态
        const prev = sessionStatus.get(msgSid)
        const updatedStatus: StatusPayload = {
          ...(prev ?? { tokens: 0, cost: 0, contextUsed: 0, contextMax: 0, roundCount: 0 }),
          contextUsed: p.tokensAfter,
          contextMax: p.contextWindow > 0 ? p.contextWindow : (prev?.contextMax ?? 0),
        }
        sessionStatus.set(msgSid, updatedStatus)
        // 仅当前会话更新 UI
        if (isCurrent) {
          setStatus('contextUsed', p.tokensAfter)
          if (p.contextWindow > 0) setStatus('contextMax', p.contextWindow)
        }
        break
      }

      case 'status.update': {
        const p = msg.payload as StatusPayload
        sessionStatus.set(msgSid, p)
        if (isCurrent) {
          // 防止 0 覆盖已有有效值（热重载/reconnect 时的竞态）
          if (p.contextUsed > 0 || status.contextUsed === 0) setStatus('contextUsed', p.contextUsed)
          if (p.contextMax > 0 || status.contextMax === 0) setStatus('contextMax', p.contextMax)
          if (p.tokens !== undefined) setStatus('tokens', p.tokens)
          if (p.cost !== undefined) setStatus('cost', p.cost)
          if (p.roundCount !== undefined) setStatus('roundCount', p.roundCount)
          if (p.model) setStatus('model', p.model)
          if (p.availableModels) setStatus('availableModels', p.availableModels)
        }
        // 同步 roundCount 到会话列表
        if (msgSid) {
          setSessions((prev) => prev.map((s) =>
            s.id === msgSid ? { ...s, roundCount: p.roundCount } : s
          ))
        }
        break
      }

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
        } else if (currentSessionId()) {
          // 热重载/重连：当前 session 仍存在，主动拉取状态恢复用量/消耗
          send('session.state', {})
        }
        break
      }

      case 'session.history': {
        const sid = msg.payload.sessionId
        const msgs = (msg.payload.messages as any[]).map((m) => ({
          messageId: m.messageId,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          thinking: '',
          partial: m.partial ?? false,
          attachments: m.attachments ?? undefined,
        })) as MessageEntry[]
        const tcs = ((msg.payload.toolCalls ?? []) as ToolCallEntry[]).map((t) =>
          t.status === 'running' ? { ...t, status: 'error' as const, output: t.output + '\n[会话中断]' } : t
        )
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

      case 'settings.state':
        setSettings((msg.payload as { entries: { key: string; value: string }[] }).entries)
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
      thinking: '',
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
  const cancelMessage = () => {
    // 立即本地清理：清空待渲染字符缓冲
    const sid = currentSessionId()
    sessionPendingChars.delete(sid)
    if (pumpRafId !== null) {
      cancelAnimationFrame(pumpRafId)
      pumpRafId = null
    }
    // 终结所有 partial 消息 + 取消所有 running 工具
    setMessages((prev) => {
      const next = prev.map((m) =>
        m.partial ? { ...m, partial: false, content: m.content || '(已中断)' } : m
      )
      sessionMessages.set(sid, next)
      return next
    })
    setToolCalls((prev) => {
      const next = prev.map((t) =>
        t.status === 'running' ? { ...t, status: 'error' as const, output: t.output + '\n[已中断]' } : t
      )
      sessionToolCalls.set(sid, next)
      return next
    })
    setIsStreaming(false)
    // 发送中断指令给桥接层
    send('message.cancel', {})
  }
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
  const getSettings = () => send('settings.get', {})
  const setSetting = (key: string, value: string) => send('settings.set', { key, value })

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

  // 外观设置 → CSS 变量
  createEffect(() => {
    const s = settings()
    const get = (k: string) => s.find((e) => e.key === k)?.value ?? ''
    const root = document.documentElement

    // 背景
    const bg = get('bg_color')
    if (bg) root.style.setProperty('--app-bg', bg)
    const bgImg = get('bg_image')
    if (bgImg) {
      root.style.setProperty('--app-bg-image', `url(file://${bgImg.replace(/\\/g, '/')})`)
    } else {
      root.style.setProperty('--app-bg-image', 'none')
    }

    // 透明度
    const opacity = get('glass_opacity')
    if (opacity) {
      const pct = parseInt(opacity) / 100
      root.style.setProperty('--glass-opacity', String(pct))
    }
  })

  connect()

  onCleanup(() => {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
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
    isSettingsOpen,
    setIsSettingsOpen,
    settings,
    getSettings,
    setSetting,
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
