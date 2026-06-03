import { WebSocketServer, WebSocket } from 'ws'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { dispatch } from './dispatcher'
import { generateUUID } from './protocol'
import { initDB, getDB } from './db'
import { startWatcher, stopWatcher, addClient, removeClient, broadcastToAll } from './watcher'

const PORT = 9229

// 初始化数据库
const db = initDB()
console.log('[bridge] SQLite initialized at ~/.personal-agent/agent.db')

// 确保主会话「澪」存在
let mainSid = (db.prepare("SELECT value FROM settings WHERE key = 'main_session_id'").get() as { value: string } | undefined)?.value
if (!mainSid) {
  mainSid = generateUUID()
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('main_session_id', ?)").run(mainSid)
  db.prepare("INSERT OR IGNORE INTO conversations (session_id, title) VALUES (?, '澪')").run(mainSid)
  console.log('[bridge] 主会话「澪」已创建:', mainSid)
}
// 初始化默认设置（首次运行）
const settingsCount = (db.prepare("SELECT COUNT(*) as cnt FROM settings WHERE key NOT LIKE 'main_%'").get() as { cnt: number }).cnt
if (settingsCount === 0) {
  const defaults: [string, string][] = [
    ['default_model', 'deepseek-v4-pro'],
    ['thinking_level', 'medium'],
    ['compact_threshold', '80'],
    ['history_retention', '100'],
    ['providers', JSON.stringify([{ id: 'deepseek', name: 'DeepSeek', apiKey: '', active: true }])],
  ]
  const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  for (const [k, v] of defaults) insert.run(k, v)
  console.log('[bridge] 默认设置已初始化')
}

// 生成 .pi/settings.json（若不存在），使用当前文件位置推导扩展绝对路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const piDir = resolve(__dirname, '.pi')
if (!existsSync(piDir)) mkdirSync(piDir, { recursive: true })
const piSettingsPath = join(piDir, 'settings.json')
const extDir = resolve(__dirname, '../extensions')
if (!existsSync(piSettingsPath)) {
  writeFileSync(piSettingsPath, JSON.stringify({
    extensions: [
      resolve(extDir, 'pa-mio/index.ts'),
      resolve(extDir, 'pa-files/index.ts'),
      resolve(extDir, 'pa-live2d/index.ts'),
    ],
  }, null, 2))
  console.log('[bridge] .pi/settings.json generated with', 3, 'extensions')
}

// Pi session 在首次消息发送或会话切换时懒创建，避免启动时竞争

const wss = new WebSocketServer({ port: PORT })

console.log(`[bridge] WebSocket server listening on ws://localhost:${PORT}`)

startWatcher()

// ── 连接 live2d-mcp 的内部 WS hub（协议 v2）──
const L2D_HUB = 'ws://127.0.0.1:9228'
let l2dWs: WebSocket | null = null

function connectL2DHub(): void {
  if (l2dWs && l2dWs.readyState === WebSocket.OPEN) return
  l2dWs = new WebSocket(L2D_HUB)
  l2dWs.on('open', () => console.log('[bridge] connected to live2d-mcp hub'))
  l2dWs.on('message', (data) => {
    try {
      const raw = JSON.parse(data.toString()) as { type: string; [key: string]: unknown }
      // Wrap WSBroadcast into MessageEnvelope format
      let envelope: { type: string; id: string; sessionId: string; ts: number; payload: unknown }
      switch (raw.type) {
        case 'expression':
          envelope = {
            type: 'live2d.expression', id: generateUUID(), sessionId: '', ts: Date.now(),
            payload: { name: raw.name },
          }
          break
        case 'motion':
          envelope = {
            type: 'live2d.motion', id: generateUUID(), sessionId: '', ts: Date.now(),
            payload: { group: raw.group, index: raw.index },
          }
          break
        case 'parameter':
          envelope = {
            type: 'live2d.parameter', id: generateUUID(), sessionId: '', ts: Date.now(),
            payload: { params: raw.params },
          }
          break
        case 'animate':
          envelope = {
            type: 'live2d.animate', id: generateUUID(), sessionId: '', ts: Date.now(),
            payload: { animation: raw.animation, params: raw.params },
          }
          break
        default:
          return
      }
      broadcastToAll(JSON.stringify(envelope))
    } catch { /* ignore malformed messages */ }
  })
  l2dWs.on('close', () => { console.log('[bridge] live2d-mcp hub disconnected'); l2dWs = null })
  l2dWs.on('error', () => { l2dWs = null })
}
connectL2DHub()
// 断线重连（每 30s 尝试）
setInterval(() => { if (!l2dWs || l2dWs.readyState !== WebSocket.OPEN) connectL2DHub() }, 30000)

wss.on('connection', (ws: WebSocket) => {
  console.log('[bridge] client connected')
  addClient(ws)

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())

      // Live2D 中继：MCP Server ↔ Bridge ↔ 浏览器
      if (msg.type === 'live2d.control' || msg.type === 'live2d.result') {
        broadcastToAll(raw.toString(), ws)
        return
      }

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
