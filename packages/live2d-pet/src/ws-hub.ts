import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'node:net'
import type { WSBroadcast } from './types.js'

export interface WSHub {
  broadcast(msg: WSBroadcast): void
  close(): void
}

/** 启动 WS Server（主实例，端口空闲时） */
function startWSServer(port: number, host: string): WSHub {
  const wss = new WebSocketServer({ port, host })
  const clients = new Set<WebSocket>()

  wss.on('connection', (ws) => {
    clients.add(ws)
    ws.on('close', () => clients.delete(ws))
    ws.on('error', () => clients.delete(ws))
  })

  wss.on('error', (err) => {
    console.error(`[live2d-mcp] WS server error: ${(err as Error).message}`)
  })

  console.error(`[live2d-mcp] WS hub listening on ws://${host}:${port}`)

  return {
    broadcast(msg: WSBroadcast) {
      const raw = JSON.stringify(msg)
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(raw)
        }
      }
    },
    close() {
      wss.close()
    },
  }
}

/** 作为 WS 客户端连接到已有 hub（端口被占用时使用） */
function connectAsClient(port: number, host: string): WSHub {
  const url = `ws://${host}:${port}`
  let ws: WebSocket | null = null
  const pending: string[] = []

  function ensure(): WebSocket {
    if (ws && ws.readyState === WebSocket.OPEN) return ws
    ws = new WebSocket(url)
    ws.on('open', () => {
      console.error(`[live2d-mcp] connected to existing hub at ${url}`)
      for (const raw of pending) {
        if (ws!.readyState === WebSocket.OPEN) ws!.send(raw)
      }
      pending.length = 0
    })
    ws.on('close', () => { ws = null })
    ws.on('error', () => { ws = null })
    return ws
  }

  // Connect eagerly
  ensure()

  return {
    broadcast(msg: WSBroadcast) {
      const raw = JSON.stringify(msg)
      const c = ws
      if (c && c.readyState === WebSocket.OPEN) {
        c.send(raw)
      } else {
        pending.push(raw)
        ensure()
      }
    },
    close() {
      ws?.close()
      ws = null
    },
  }
}

/** 检测端口是否可用 */
function isPortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    server.listen(port, host)
  })
}

/** 启动或连接：端口空闲则启动 server，已被占用则作为 client 连接 */
export async function startOrConnectWS(port: number, host: string): Promise<WSHub> {
  const free = await isPortFree(port, host)
  if (free) {
    return startWSServer(port, host)
  }
  console.error(`[live2d-mcp] port ${port} in use, connecting as client`)
  return connectAsClient(port, host)
}
