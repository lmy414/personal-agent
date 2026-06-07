import type { ServerMessage } from '@bridge/protocol'

const WS_URL = 'ws://localhost:9229'
const HEARTBEAT_INTERVAL = 30000
const RECONNECT_BASE_DELAY = 3000
const MAX_RECONNECT_DELAY = 30000

export interface WsConnection {
  /** Send a raw JSON string, buffering if disconnected */
  send: (raw: string) => void
  /** Stop heartbeat + close WebSocket */
  cleanup: () => void
}

/**
 * WebSocket 连接生命周期管理
 *
 * - connect / reconnect (exponential backoff)
 * - heartbeat (ping every 30s)
 * - pending send buffer (queues messages when disconnected, flushes on reconnect)
 */
export function createWsConnection(opts: {
  onOpen: () => void
  onMessage: (msg: ServerMessage) => void
  onClose: () => void
}): WsConnection {
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let reconnectAttempts = 0
  const pendingSends: string[] = []

  const connect = () => {
    ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      reconnectAttempts = 0
      heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', id: '', sessionId: '', ts: Date.now(), payload: {} }))
        }
      }, HEARTBEAT_INTERVAL)
      // Flush buffered sends
      while (pendingSends.length > 0) {
        const raw = pendingSends.shift()!
        ws!.send(raw)
      }
      opts.onOpen()
    }

    ws.onmessage = (event) => {
      opts.onMessage(JSON.parse(event.data as string) as ServerMessage)
    }

    ws.onclose = () => {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
      if (reconnectTimer) clearTimeout(reconnectTimer)
      const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY)
      reconnectAttempts++
      reconnectTimer = setTimeout(connect, delay)
      opts.onClose()
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  const send = (raw: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(raw)
    } else {
      pendingSends.push(raw)
    }
  }

  const cleanup = () => {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
  }

  connect()

  return { send, cleanup }
}
