import { WebSocketServer, WebSocket } from 'ws'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { dispatch } from './dispatcher'
import { generateUUID } from './protocol'
import { initDB, getDB } from './db'
import { startWatcher, stopWatcher, addClient, removeClient } from './watcher'
import { addSkillClient, removeSkillClient } from './handlers/skills'

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
    ['work_dir', ''],
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
      resolve(extDir, 'pa-mcp/index.ts'),
    ],
  }, null, 2))
  console.log('[bridge] .pi/settings.json generated with', 3, 'extensions')
}

// Pi session 在首次消息发送或会话切换时懒创建，避免启动时竞争

const wss = new WebSocketServer({ port: PORT })

console.log(`[bridge] WebSocket server listening on ws://localhost:${PORT}`)

startWatcher()

wss.on('connection', (ws: WebSocket) => {
  addClient(ws)
  addSkillClient(ws)

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
