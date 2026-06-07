import { createContext, createSignal, onCleanup, useContext, type Component, type JSX } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { ServerMessage, StatusPayload, SessionInfo, AgentInfo } from '@bridge/protocol'
import { createWsConnection } from './use-ws'
import { createSessionCache } from './use-session-cache'
import { createCharPump } from './char-pump'
import { createSettings } from './use-settings'
import { createAgents } from './use-agents'
import { restoreTheme, restoreWallpaper, restoreCustomAccent, restoreGlassTint, restoreTopBarTint } from './theme'

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
  subscribe: <T extends ServerMessage['type']>(
    type: T,
    handler: (msg: Extract<ServerMessage, { type: T }>) => void,
  ) => (() => void)
  settings: () => { key: string; value: string }[]
  getSettings: () => void
  setSetting: (key: string, value: string) => void
  saveProvider: (id: string, name: string, opts?: { apiUrl?: string; apiKey?: string; active?: boolean }) => void
  deleteProvider: (id: string) => void
  configureModel: (modelId: string, config: { thinkingLevel?: string; compactThreshold?: number; enabled?: boolean; visible?: boolean }) => void
  agents: () => AgentInfo[]
  switchAgent: (agentId: string) => void
  createAgent: (name: string, provider: string, modelId: string, opts?: { avatarColor?: string; roleDescription?: string }) => void
  updateAgent: (agentId: string, updates: { name?: string; avatarColor?: string; roleDescription?: string }) => void
  deleteAgent: (agentId: string) => void
  setDefaultAgent: (agentId: string) => void
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

  const cache = createSessionCache()

  const syncSignalToCache = () => {
    const sid = currentSessionId()
    cache.messages.set(sid, messages())
    cache.toolCalls.set(sid, toolCalls())
  }

  const wsConn = createWsConnection({
    onOpen() {
      setConnected(true)
      setIsStreaming(false)
      // 初始化：请求 session 列表 + 模型列表 + 设置
      const rawSend = wsConn.send
      for (const raw of [
        JSON.stringify({ type: 'session.list', id: crypto.randomUUID(), sessionId: '', ts: Date.now(), payload: {} }),
        JSON.stringify({ type: 'agent.model.list', id: crypto.randomUUID(), sessionId: currentSessionId(), ts: Date.now(), payload: {} }),
        JSON.stringify({ type: 'settings.get', id: crypto.randomUUID(), sessionId: currentSessionId(), ts: Date.now(), payload: {} }),
      ]) {
        rawSend(raw)
      }
    },
    onMessage(msg: ServerMessage) {
      handleServerMessage(msg)
    },
    onClose() {
      setConnected(false)
    },
  })

  const pump = createCharPump({
    getSessionId: currentSessionId,
    pendingChars: cache.pendingChars,
    setMessages,
    syncToCache: (sid, msgs) => cache.messages.set(sid, msgs),
  })

  const send = (type: string, payload: unknown) => {
    wsConn.send(JSON.stringify({
      type,
      id: crypto.randomUUID(),
      sessionId: currentSessionId() || props.sessionId,
      ts: Date.now(),
      payload,
    }))
  }

  const settingsStore = createSettings(send)
  const agentsStore = createAgents(send)

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
        const bg = cache.messages.get(msgSid) ?? []
        cache.messages.set(msgSid, [...bg, entry])
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
              cache.messages.set(msgSid, next)
              return next
            })
          } else {
            const bg = cache.messages.get(msgSid)
            if (bg) cache.messages.set(msgSid, appendThinking(bg))
          }
        } else {
          // 文本 delta → 逐字动画
          const pending = cache.getPendingChars(msgSid)
          pending.set(msgId, (pending.get(msgId) ?? '') + msg.payload.delta)
          if (isCurrent) pump.schedulePump()
        }
        break
      }

      case 'message.end': {
        // 先排空该消息的 pending chars，追加到当前 content，再标记完成
        const pending = cache.pendingChars.get(msgSid)
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
            cache.messages.set(msgSid, next)
            return next
          })
        } else {
          const bg = cache.messages.get(msgSid)
          if (bg) cache.messages.set(msgSid, finalize(bg))
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
        const bg = cache.toolCalls.get(msgSid) ?? []
        cache.toolCalls.set(msgSid, [...bg, entry])
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
            cache.toolCalls.set(msgSid, next)
            return next
          })
        } else {
          const bg = cache.toolCalls.get(msgSid)
          if (bg) cache.toolCalls.set(msgSid, finalize(bg))
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
        const curCtxMax = cache.status.get(msgSid)?.contextMax ?? status.contextMax
        cache.status.set(msgSid, {
          ...(cache.status.get(msgSid) ?? status),
          contextUsed: p.contextUsed,
          contextMax: p.contextMax > 0 || curCtxMax === 0 ? p.contextMax : curCtxMax,
          roundCount: p.roundCount,
          model: p.model,
          tokens: p.tokens ?? (cache.status.get(msgSid)?.tokens ?? 0),
          cost: p.cost ?? (cache.status.get(msgSid)?.cost ?? 0),
        })
        setSessions((prev) => prev.map((s) =>
          s.id === msgSid ? { ...s, roundCount: p.roundCount } : s
        ))
        break
      }

      case 'session.compacted': {
        const p = msg.payload as { tokensBefore: number; tokensAfter: number; tokensSaved: number; contextWindow: number }
        // 更新该 session 的缓存状态
        const prev = cache.status.get(msgSid)
        const updatedStatus: StatusPayload = {
          ...(prev ?? { tokens: 0, cost: 0, contextUsed: 0, contextMax: 0, roundCount: 0 }),
          contextUsed: p.tokensAfter,
          contextMax: p.contextWindow > 0 ? p.contextWindow : (prev?.contextMax ?? 0),
        }
        cache.status.set(msgSid, updatedStatus)
        // 仅当前会话更新 UI
        if (isCurrent) {
          setStatus('contextUsed', p.tokensAfter)
          if (p.contextWindow > 0) setStatus('contextMax', p.contextWindow)
        }
        break
      }

      case 'status.update': {
        const p = msg.payload as StatusPayload
        cache.status.set(msgSid, p)
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
        cache.messages.set(sid, [])
        cache.toolCalls.set(sid, [])
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
        cache.messages.set(sid, msgs)
        cache.toolCalls.set(sid, tcs)
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
        cache.deleteSession(msg.payload.sessionId)
        break

      case 'settings.state':
        settingsStore.setEntries((msg.payload as { entries: { key: string; value: string }[] }).entries)
        restoreTheme((msg.payload as { entries: { key: string; value: string }[] }).entries)
        restoreWallpaper((msg.payload as { entries: { key: string; value: string }[] }).entries)
        restoreCustomAccent((msg.payload as { entries: { key: string; value: string }[] }).entries)
        restoreGlassTint((msg.payload as { entries: { key: string; value: string }[] }).entries)
        restoreTopBarTint((msg.payload as { entries: { key: string; value: string }[] }).entries)
        break

      // ── 智能体事件 ──

      case 'agent.list':
        agentsStore.handleAgentList((msg.payload as { agents: AgentInfo[] }).agents)
        break

      case 'agent.created':
        agentsStore.handleAgentCreated((msg.payload as { agent: AgentInfo }).agent)
        break

      case 'agent.updated':
        agentsStore.handleAgentUpdated((msg.payload as { agent: AgentInfo }).agent)
        break

      case 'agent.deleted':
        agentsStore.handleAgentDeleted((msg.payload as { agentId: string }).agentId)
        break

      case 'agent.default_changed':
        agentsStore.handleAgentDefaultChanged((msg.payload as { agentId: string }).agentId)
        break

      // ── 状态同步 ──

      case 'state.model':
        setStatus('model', (msg.payload as { modelId: string }).modelId)
        break

      case 'state.thinking':
        // thinking level 变更暂不更新 UI（status bar 不展示 thinking level）
        break

      case 'state.tools':
        // tools 变更暂不更新 UI
        break

      case 'turn.error': {
        const p = msg.payload as { code: string; message: string; recoverable: boolean }
        console.error('[turn error]', p.code, p.message)
        setIsStreaming(false)
        break
      }

      // ── 记忆 ──

      case 'memory.results':
      case 'memory.list':
        // 记忆结果由 memory 扩展通过 subscribe 消费，此处不处理
        break

      // ── 文件 ──

      case 'file.list':
      case 'file.changed':
        // 文件列表/变更由 file-tree 扩展通过 subscribe 消费
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
      cache.messages.set(currentSessionId(), next)
      return next
    })
    send('agent.prompt', { content, attachments })
  }
  const cancelMessage = () => {
    // 立即本地清理：清空待渲染字符缓冲
    const sid = currentSessionId()
    cache.pendingChars.delete(sid)
    pump.cleanup()
    // 终结所有 partial 消息 + 取消所有 running 工具
    setMessages((prev) => {
      const next = prev.map((m) =>
        m.partial ? { ...m, partial: false, content: m.content || '(已中断)' } : m
      )
      cache.messages.set(sid, next)
      return next
    })
    setToolCalls((prev) => {
      const next = prev.map((t) =>
        t.status === 'running' ? { ...t, status: 'error' as const, output: t.output + '\n[已中断]' } : t
      )
      cache.toolCalls.set(sid, next)
      return next
    })
    setIsStreaming(false)
    // 发送中断指令给桥接层
    send('agent.abort', {})
  }
  const loadHistory = (sid: string) => {
    wsConn.send(JSON.stringify({
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
    // 保存当前状态到 cache.status
    cache.status.set(currentSessionId(), { ...status })

    setCurrentSessionId(sid)

    if (cache.messages.has(sid)) {
      setMessages(cache.messages.get(sid)!)
      setToolCalls(cache.toolCalls.get(sid) ?? [])
    } else {
      setMessages([])
      setToolCalls([])
    }

    // 恢复该 session 的 status
    const savedStatus = cache.status.get(sid)
    if (savedStatus) setStatus(savedStatus)

    // 如果有后台流式残留的 pending chars，恢复泵送
    const pending = cache.pendingChars.get(sid)
    if (pending && pending.size > 0) {
      pump.schedulePump()
    }

    send('session.switch', { sessionId: sid })
    if (!cache.messages.has(sid)) {
      loadHistory(sid)
    }
  }
  const switchModel = (modelId: string) => send('agent.model.set', { modelId })
  const getSettings = () => settingsStore.getSettings()
  const setSetting = (key: string, value: string) => settingsStore.setSetting(key, value)

  // ========== 扩展消息订阅 ==========

  const msgListeners = new Map<ServerMessage['type'], Set<(msg: ServerMessage) => void>>()

  function subscribe<T extends ServerMessage['type']>(
    type: T,
    handler: (msg: Extract<ServerMessage, { type: T }>) => void,
  ): () => void {
    const wrapped = (msg: ServerMessage) => handler(msg as Extract<ServerMessage, { type: T }>)
    let set = msgListeners.get(type)
    if (!set) {
      set = new Set()
      msgListeners.set(type, set)
    }
    set.add(wrapped)
    return () => {
      set?.delete(wrapped)
      if (set?.size === 0) msgListeners.delete(type)
    }
  }

  onCleanup(() => {
    pump.cleanup()
    wsConn.cleanup()
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
    settings: settingsStore.entries,
    getSettings,
    setSetting,
    saveProvider: settingsStore.saveProvider,
    deleteProvider: settingsStore.deleteProvider,
    configureModel: settingsStore.configureModel,
    agents: agentsStore.agents,
    switchAgent: agentsStore.switchAgent,
    createAgent: agentsStore.createAgent,
    updateAgent: agentsStore.updateAgent,
    deleteAgent: agentsStore.deleteAgent,
    setDefaultAgent: agentsStore.setDefaultAgent,
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
