import { WebSocketServer, WebSocket } from 'ws'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { dispatch } from './dispatcher'
import { initDB } from './init-db'
import { initPiConfig } from './init-config'
import { initAgents } from './init-agents'
import { startWatcher, stopWatcher, addClient, removeClient } from './watcher'
import { addSkillClient, removeSkillClient } from './handlers/skills'
import { addAgentClient, removeAgentClient } from './handlers/agent'

const PORT = 9229

// 初始化
const db = initDB()
const __dirname = dirname(fileURLToPath(import.meta.url))
initPiConfig(__dirname)
initAgents()

// Pi session 在首次消息发送或会话切换时懒创建，避免启动时竞争

const wss = new WebSocketServer({ port: PORT })

console.log(`[bridge] WebSocket server listening on ws://localhost:${PORT}`)

startWatcher()

wss.on('connection', (ws: WebSocket) => {
  addClient(ws)
  addSkillClient(ws)
  addAgentClient(ws)

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())

      dispatch(msg, ws)
    } catch (err) {
      console.error('[bridge] failed to parse message:', err)
      ws.send(JSON.stringify({
        type: 'error',
        id: 'err-parse',
        sessionId: '',
        ts: Date.now(),
        payload: { code: 'PARSE_ERROR', message: 'Invalid JSON', recoverable: true },
      }))
    }
  })

  ws.on('close', () => {
    removeClient(ws)
    removeSkillClient(ws)
    removeAgentClient(ws)
  })

  ws.on('error', (err) => {
    console.error('[bridge] ws error:', err)
  })
})

function shutdown() {
  stopWatcher()
  // 优雅关闭：先关闭 WebSocket，再关闭 DB，最后退出
  wss.close(() => {
    try { db.close() } catch { /* already closed */ }
    console.log('[bridge] shutdown complete')
    process.exit(0)
  })
  // 超时强制退出（防止 wss.close 因长连接挂起）
  setTimeout(() => {
    try { db.close() } catch { /* already closed */ }
    process.exit(1)
  }, 5000)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
