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

type AgentContextValue = AgentState & AgentActions

// ========== Context ==========

const AgentContext = createContext<AgentContextValue>()

// ========== Provider ==========

export const AgentProvider: Component<{ sessionId: string; children: JSX.Element }> = (props) => {
  const [connected, setConnected] = createSignal(false)
  const [messages, setMessages] = createSignal<MessageEntry[]>([])
  const [toolCalls, setToolCalls] = createSignal<ToolCallEntry[]>([])
  const [sessions, setSessions] = createSignal<SessionInfo[]>([])
  const [status, setStatus] = createStore<StatusPayload>({
    tokens: 0, cost: 0, contextUsed: 0, contextMax: 128000, roundCount: 0,
  })

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const connect = () => {
    ws = new WebSocket('ws://localhost:9229')

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data as string)
      handleServerMessage(msg)
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectTimer = setTimeout(connect, 2000)
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  const handleServerMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'message.start':
        setMessages((prev) => [...prev, {
          messageId: msg.payload.messageId,
          role: msg.payload.role,
          content: '',
          partial: true,
        }])
        break

      case 'message.delta':
        setMessages((prev) => prev.map((m) =>
          m.messageId === msg.payload.messageId && m.partial
            ? { ...m, content: m.content + msg.payload.delta }
            : m
        ))
        break

      case 'message.end':
        setMessages((prev) => prev.map((m) =>
          m.messageId === msg.payload.messageId
            ? { ...m, content: msg.payload.content, partial: false }
            : m
        ))
        break

      case 'tool.start':
        setToolCalls((prev) => [...prev, {
          toolCallId: msg.payload.toolCallId,
          toolName: msg.payload.toolName,
          input: msg.payload.input,
          output: '',
          duration: 0,
          status: 'running',
        }])
        break

      case 'tool.progress':
        setToolCalls((prev) => prev.map((t) =>
          t.toolCallId === msg.payload.toolCallId
            ? { ...t, output: t.output + msg.payload.output }
            : t
        ))
        break

      case 'tool.end':
        setToolCalls((prev) => prev.map((t) =>
          t.toolCallId === msg.payload.toolCallId
            ? { ...t, output: msg.payload.output, duration: msg.payload.duration, status: msg.payload.status }
            : t
        ))
        break

      case 'status.update':
        setStatus(msg.payload)
        break

      case 'session.list':
        setSessions(msg.payload.sessions)
        break
    }
  }

  const send = (type: string, payload: unknown) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      type,
      id: crypto.randomUUID(),
      sessionId: props.sessionId,
      ts: Date.now(),
      payload,
    }))
  }

  const createSession = (model?: string) => send('session.create', { model })
  const sendMessage = (content: string) => send('message.send', { content })
  const cancelMessage = () => send('message.cancel', {})
  const switchSession = (sessionId: string) => send('session.switch', { sessionId })
  const switchModel = (modelId: string) => send('model.switch', { modelId })

  connect()

  onCleanup(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
  })

  const value: AgentContextValue = {
    get connected() { return connected() },
    sessionId: props.sessionId,
    get messages() { return messages() },
    get toolCalls() { return toolCalls() },
    sessions: sessions(),
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
