import { WebSocket } from 'ws'

/**
 * 客户端连接集 — 统一的 WS 客户端追踪 + 广播
 *
 * 每个子系统（文件监听 / 技能 / 智能体）持有独立实例，
 * add/remove 在 ws connection/close 生命周期中调用。
 */
export interface ClientSet {
  add(ws: WebSocket): void
  remove(ws: WebSocket): void
  /** 向所有客户端广播 raw JSON 字符串 */
  broadcast(raw: string): void
  /** 排除指定客户端的广播 */
  broadcastExcept(raw: string, exclude: WebSocket): void
}

export function createClientSet(): ClientSet {
  const clients = new Set<WebSocket>()

  return {
    add(ws) { clients.add(ws) },
    remove(ws) { clients.delete(ws) },
    broadcast(raw) {
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(raw)
      }
    },
    broadcastExcept(raw, exclude) {
      for (const ws of clients) {
        if (ws !== exclude && ws.readyState === WebSocket.OPEN) ws.send(raw)
      }
    },
  }
}
