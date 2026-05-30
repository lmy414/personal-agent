import { WebSocketServer, WebSocket } from 'ws'
import { dispatch } from './dispatcher'
import { initDB, getDB } from './db'
import { startWatcher, stopWatcher, addClient, removeClient } from './watcher'

const PORT = 9229

// 初始化数据库
const db = initDB()
console.log('[bridge] SQLite initialized at ~/.personal-agent/agent.db')

// 确保主会话「澪」存在
let mainSid = (db.prepare("SELECT value FROM settings WHERE key = 'main_session_id'").get() as { value: string } | undefined)?.value
if (!mainSid) {
  mainSid = crypto.randomUUID()
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('main_session_id', ?)").run(mainSid)
  db.prepare("INSERT OR IGNORE INTO conversations (session_id, title) VALUES (?, '澪')").run(mainSid)
  console.log('[bridge] 主会话「澪」已创建:', mainSid)
}
// Pi session 在首次消息发送或会话切换时懒创建，避免启动时竞争

const wss = new WebSocketServer({ port: PORT })

console.log(`[bridge] WebSocket server listening on ws://localhost:${PORT}`)

startWatcher()

wss.on('connection', (ws: WebSocket) => {
  console.log('[bridge] client connected')
  addClient(ws)

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
    console.log('[bridge] client disconnected')
    removeClient(ws)
  })

  ws.on('error', (err) => {
    console.error('[bridge] ws error:', err)
  })
})

process.on('SIGINT', () => { stopWatcher(); process.exit() })
process.on('SIGTERM', () => { stopWatcher(); process.exit() })
