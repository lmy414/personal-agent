# 会话管理完善 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善会话全生命周期：主会话「澪」、子会话切换/删除/自动命名、历史消息 SQLite 持久化与恢复。

**Architecture:** Bridge 用 better-sqlite3 直读 `~/.personal-agent/agent.db`（与 pa-sqlite 共享）。新增 `session.history` / `session.rename` 协议。前端 `useAgent` 加 sessionId 级缓存（Map<sessionId, messages/toolCalls>），SessionPanel 重写为两层布局。

**Tech Stack:** TypeScript, better-sqlite3, SolidJS, WebSocket

---

## 文件清单

| 文件 | 操作 |
|------|------|
| `bridge/db.ts` | **新建** — SQLite 封装 |
| `bridge/protocol.ts` | 修改 — 加消息类型 |
| `bridge/dispatcher.ts` | 修改 — 加路由 |
| `bridge/handlers/session.ts` | 重写 — 加 history/list/delete/rename |
| `bridge/handlers/message.ts` | 修改 — 加 tool_calls 写入 + AI 摘要 |
| `bridge/index.ts` | 修改 — 启动时初始化 DB + 主会话 |
| `bridge/package.json` | 修改 — 加 better-sqlite3 依赖 |
| `frontend/src/shell/useAgent.tsx` | 修改 — 加 session 级缓存 + loadHistory |
| `frontend/src/extensions/session-panel/SessionPanel.tsx` | 重写 |
| `frontend/src/extensions/chat-renderer/ChatRenderer.tsx` | 修改 — 监听 currentSid 变化 |
| `frontend/src/extensions/tool-panel/ToolPanel.tsx` | 修改 — 跟随 session 切换 |

---

### Task 1: 安装 better-sqlite3 + 创建 DB 封装

**Files:**
- Create: `bridge/db.ts`
- Modify: `bridge/package.json`

- [ ] **Step 1: 安装 better-sqlite3**

```bash
cd D:/claude/personal-agent/bridge && npm install better-sqlite3
```

- [ ] **Step 2: 创建 bridge/db.ts**

```ts
import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

const PA_DIR = path.join(os.homedir(), '.personal-agent')
const DB_PATH = path.join(PA_DIR, 'agent.db')

let db: Database.Database | null = null

export function getDB(): Database.Database {
  if (!db) throw new Error('DB not initialized - call initDB() first')
  return db
}

export function initDB(): Database.Database {
  if (!fs.existsSync(PA_DIR)) fs.mkdirSync(PA_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Ensure existing tables (pa-sqlite may have created them)
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'New Chat',
      session_id TEXT UNIQUE,
      session_file TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      message_id TEXT DEFAULT '',
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
      content TEXT NOT NULL,
      tokens_input INTEGER DEFAULT 0,
      tokens_output INTEGER DEFAULT 0,
      model TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tool_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      tool_call_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      input TEXT DEFAULT '',
      output TEXT DEFAULT '',
      status TEXT DEFAULT 'running',
      duration INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  return db
}
```

- [ ] **Step 3: 验证编译**

```bash
cd D:/claude/personal-agent/bridge && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add bridge/db.ts bridge/package.json bridge/package-lock.json
git commit -m "feat: 创建 SQLite 封装 + better-sqlite3 依赖"
```

---

### Task 2: 协议新增 + 路由注册

**Files:**
- Modify: `bridge/protocol.ts` — 加类型
- Modify: `bridge/dispatcher.ts` — 加路由入口

- [ ] **Step 1: 在 protocol.ts 的 ServerMessage 联合类型中加新类型**

在 `bridge/protocol.ts` 的 `ServerMessage` 类型定义中，`| ServerMsg<'error', ...>` 前加入：

```ts
  | ServerMsg<'session.history', { sessionId: string; messages: { messageId: string; role: 'user' | 'assistant'; content: string; partial: boolean }[]; toolCalls: { toolCallId: string; toolName: string; input: Record<string, unknown>; output: string; duration: number; status: 'running' | 'success' | 'error' }[] }>
  | ServerMsg<'session.renamed', { sessionId: string; title: string }>
  | ServerMsg<'session.deleted', { sessionId: string }>
```

同步在 `ClientMessage` 类型中加入：

```ts
  | ClientMsg<'session.history', { sessionId: string }>
  | ClientMsg<'session.rename', { sessionId: string; title: string }>
```

- [ ] **Step 2: 在 dispatcher.ts 路由表中注册**

```ts
// 在 handlers 导入中加入:
import { handleSessionCreate, handleSessionList, handleSessionSwitch, handleSessionDelete, handleSessionHistory, handleSessionRename } from './handlers/session'

// 在 routes 中加入:
'session.history': handleSessionHistory,
'session.rename': handleSessionRename,
```

- [ ] **Step 3: 验证编译**

```bash
cd D:/claude/personal-agent/bridge && npx tsc --noEmit
```

Expected: 0 errors（handler 函数声明不存在会有 TS 错误，这是预期的——Task 3 会创建它们）。

实际上先跳过 tsc 检查，Task 3 完成后一起查。

- [ ] **Step 4: Commit**

```bash
git add bridge/protocol.ts bridge/dispatcher.ts
git commit -m "feat: protocol 添加 session.history/rename/delete 消息类型"
```

---

### Task 3: session.ts handler 重写

**Files:**
- Modify: `bridge/handlers/session.ts` — 完全重写

完整代码：

```ts
import type { WebSocket } from 'ws'
import type { ClientMessage, SessionInfo } from '../protocol'
import {
  createPiSession,
  getPiSession,
  removePiSession,
  getAllSessionMeta,
  getSessionMeta,
  updateSessionMeta,
} from '../pi-session'
import { getDB } from '../db'

// ── session.create（已有，不变）───────────────────────────────

export async function handleSessionCreate(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const payload = (msg.payload ?? {}) as { model?: string; thinkingLevel?: 'low' | 'medium' | 'high' }
  const result = await createPiSession({
    modelName: payload.model,
    thinkingLevel: payload.thinkingLevel,
  })

  // 写入 SQLite
  const db = getDB()
  db.prepare(
    'INSERT OR IGNORE INTO conversations (session_id, title) VALUES (?, ?)',
  ).run(result.sessionId, `新会话 ${new Date().toLocaleDateString('zh-CN')}`)

  ws.send(JSON.stringify({
    type: 'session.created',
    id: `srv-${Date.now()}`,
    sessionId: result.sessionId,
    ts: Date.now(),
    payload: {
      sessionId: result.sessionId,
      model: result.model,
      thinkingLevel: result.thinkingLevel,
      createdAt: Date.now(),
    },
  }))
}

// ── session.list（增强：合并 SQLite + Pi 内存，澪置顶）─────────

function getMainSessionId(): string {
  const row = getDB().prepare("SELECT value FROM settings WHERE key = 'main_session_id'").get() as
    | { value: string }
    | undefined
  return row?.value ?? ''
}

export function handleSessionList(_msg: ClientMessage, ws: WebSocket): void {
  const db = getDB()
  const mainSid = getMainSessionId()

  // 从 SQLite 取所有持久化会话
  const dbSessions = db.prepare(`
    SELECT session_id, title, updated_at, created_at FROM conversations ORDER BY updated_at DESC
  `).all() as { session_id: string; title: string; updated_at: string; created_at: string }[]

  // 从 Pi 内存取活跃会话的 roundCount
  const piMetaMap = new Map(getAllSessionMeta().map((m) => [m.id, m]))

  // 合并：去重，澪置顶
  const seen = new Set<string>()
  const list: SessionInfo[] = []

  // 澪始终置顶
  if (mainSid) {
    const mainMeta = piMetaMap.get(mainSid)
    const mainDb = dbSessions.find((r) => r.session_id === mainSid)
    seen.add(mainSid)
    list.push({
      id: mainSid,
      title: '澪',
      lastActive: mainMeta?.createdAt ?? Date.now(),
      roundCount: mainMeta?.roundCount ?? 0,
    })
  }

  // 子会话：Pi 内存中的优先
  for (const [id, meta] of piMetaMap) {
    if (seen.has(id)) continue
    seen.add(id)
    const dbRow = dbSessions.find((r) => r.session_id === id)
    list.push({
      id,
      title: dbRow?.title ?? meta.title,
      lastActive: meta.createdAt,
      roundCount: meta.roundCount,
    })
  }

  // SQLite 中未加载到 Pi 的
  for (const row of dbSessions) {
    if (seen.has(row.session_id)) continue
    seen.add(row.session_id)
    list.push({
      id: row.session_id,
      title: row.title,
      lastActive: new Date(row.updated_at).getTime(),
      roundCount: 0,
    })
  }

  ws.send(JSON.stringify({
    type: 'session.list',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { sessions: list },
  }))
}

// ── session.switch（已有，不变）───────────────────────────────

export function handleSessionSwitch(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { sessionId: string }
  const session = getPiSession(payload.sessionId)
  const contextUsage = session?.getContextUsage()
  const meta = getSessionMeta(payload.sessionId)

  ws.send(JSON.stringify({
    type: 'session.state',
    id: `srv-${Date.now()}`,
    sessionId: payload.sessionId,
    ts: Date.now(),
    payload: {
      model: meta?.modelName ?? 'deepseek-v3',
      thinkingLevel: meta?.thinkingLevel ?? 'medium',
      contextUsed: contextUsage?.used ?? 0,
      roundCount: meta?.roundCount ?? 0,
    },
  }))
}

// ── session.history（新增：加载历史消息 + 工具调用）────────────

export function handleSessionHistory(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { sessionId: string }
  const db = getDB()

  const messages = db.prepare(`
    SELECT m.message_id, m.role, m.content
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.session_id = ?
    ORDER BY m.id ASC
  `).all(payload.sessionId) as { message_id: string; role: string; content: string }[]

  const toolCalls = db.prepare(`
    SELECT tool_call_id, tool_name, input, output, status, duration
    FROM tool_calls
    WHERE session_id = ?
    ORDER BY id ASC
  `).all(payload.sessionId) as {
    tool_call_id: string; tool_name: string; input: string; output: string; status: string; duration: number
  }[]

  ws.send(JSON.stringify({
    type: 'session.history',
    id: `srv-${Date.now()}`,
    sessionId: payload.sessionId,
    ts: Date.now(),
    payload: {
      sessionId: payload.sessionId,
      messages: messages.map((m) => ({
        messageId: m.message_id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        partial: false,
      })),
      toolCalls: toolCalls.map((t) => ({
        toolCallId: t.tool_call_id,
        toolName: t.tool_name,
        input: t.input ? JSON.parse(t.input) : {},
        output: t.output,
        duration: t.duration,
        status: t.status as 'running' | 'success' | 'error',
      })),
    },
  }))
}

// ── session.rename（新增：更新 SQLite + Pi 内存标题）───────────

export function handleSessionRename(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { sessionId: string; title: string }
  const db = getDB()

  db.prepare('UPDATE conversations SET title = ?, updated_at = datetime(?) WHERE session_id = ?').run(
    payload.title, new Date().toISOString(), payload.sessionId,
  )

  updateSessionMeta(payload.sessionId, { title: payload.title })

  ws.send(JSON.stringify({
    type: 'session.renamed',
    id: `srv-${Date.now()}`,
    sessionId: payload.sessionId,
    ts: Date.now(),
    payload: { sessionId: payload.sessionId, title: payload.title },
  }))
}

// ── session.delete（增强：级联删 SQLite，禁删澪）─────────────────

function isMainSession(sessionId: string): boolean {
  return sessionId === getMainSessionId()
}

export function handleSessionDelete(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { sessionId: string }

  if (isMainSession(payload.sessionId)) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: payload.sessionId,
      ts: Date.now(),
      payload: { code: 'MAIN_SESSION_PROTECTED', message: '无法删除主会话「澪」', recoverable: true },
    }))
    return
  }

  // 级联删 SQLite（conversations + messages via FK, tool_calls 手动）
  const db = getDB()
  db.prepare('DELETE FROM tool_calls WHERE session_id = ?').run(payload.sessionId)
  db.prepare('DELETE FROM conversations WHERE session_id = ?').run(payload.sessionId)

  // 删 Pi 内存
  removePiSession(payload.sessionId)

  ws.send(JSON.stringify({
    type: 'session.deleted',
    id: `srv-${Date.now()}`,
    sessionId: payload.sessionId,
    ts: Date.now(),
    payload: { sessionId: payload.sessionId },
  }))
}
```

- [ ] **Step 1: 验证编译**

```bash
cd D:/claude/personal-agent/bridge && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add bridge/handlers/session.ts
git commit -m "feat: session handler 加入 history/list/delete/rename 全功能"
```

---

### Task 4: message.ts 增强 — tool_calls 持久化 + AI 摘要

**Files:**
- Modify: `bridge/handlers/message.ts`

**改动 1：** 在 `tool_execution_start` 的 WS send 后加 SQLite 写入：

```ts
// 在 handleMessageSend 的 tool_execution_start case 中，WS send 之后加:
const db = getDB()
db.prepare(
  'INSERT INTO tool_calls (session_id, tool_call_id, tool_name, input, status) VALUES (?, ?, ?, ?, ?)',
).run(msg.sessionId, event.toolCallId, event.toolName, JSON.stringify(event.args ?? {}), 'running')
```

**改动 2：** 在 `tool_execution_end` 的 WS send 后加 SQLite 更新：

```ts
// 在 tool_execution_end case 中，WS send 之后加:
const db = getDB()
db.prepare(
  'UPDATE tool_calls SET output = ?, status = ?, duration = ? WHERE tool_call_id = ?',
).run(
  typeof event.result === 'string' ? event.result : JSON.stringify(event.result),
  event.isError ? 'error' : 'success',
  0,
  event.toolCallId,
)
```

**改动 3：** 在 `agent_end` case 中，`updateSessionMeta` 之后加 AI 摘要逻辑：

```ts
// 在 agent_end case 中，roundCount 更新之后加:
// 首轮完成后自动命名（roundCount 变为 2，因为 meta.roundCount 在下面加 1）
const newRoundCount = (meta?.roundCount ?? 0) + 1
if (newRoundCount === 2) {
  // 异步生成标题，不阻塞 turn.end
  generateSessionTitle(msg.sessionId).then((title) => {
    if (title) {
      const db = getDB()
      db.prepare('UPDATE conversations SET title = ?, updated_at = datetime(?) WHERE session_id = ?').run(
        title, new Date().toISOString(), msg.sessionId,
      )
      updateSessionMeta(msg.sessionId, { title })
      ws.send(JSON.stringify({
        type: 'session.renamed',
        id: `srv-${Date.now()}`,
        sessionId: msg.sessionId,
        ts: Date.now(),
        payload: { sessionId: msg.sessionId, title },
      }))
    }
  })
}
```

**改动 4：** 加 `generateSessionTitle` 函数（文件顶部）：

```ts
async function generateSessionTitle(sessionId: string): Promise<string | null> {
  try {
    const db = getDB()
    const msgs = db.prepare(`
      SELECT m.role, m.content
      FROM messages m JOIN conversations c ON m.conversation_id = c.id
      WHERE c.session_id = ?
      ORDER BY m.id ASC
    `).all(sessionId) as { role: string; content: string }[]

    if (msgs.length < 2) return null

    const userMsg = msgs.find((m) => m.role === 'user')?.content?.slice(0, 200) ?? ''
    const aiMsg = msgs.find((m) => m.role === 'assistant')?.content?.slice(0, 200) ?? ''

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return null

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '用3-5个汉字总结这段对话的主题。只输出主题本身，不要解释，不要标点。' },
          { role: 'user', content: `用户: ${userMsg}\n\n助手: ${aiMsg}\n\n用3-5个汉字总结主题:` },
        ],
        max_tokens: 15,
        temperature: 0.3,
      }),
    })

    const data = await resp.json() as any
    const title = data.choices?.[0]?.message?.content?.trim()
    return title?.slice(0, 20) ?? null
  } catch {
    return null
  }
}
```

同时在文件顶部加 import：
```ts
import { getDB } from '../db'
```

**改动 5：** 在 `message_end` case 中加 SQLite 写入：

```ts
// 在 message_end case 的 WS send 之后加:
try {
  const db = getDB()
  const conv = db.prepare('SELECT id FROM conversations WHERE session_id = ?').get(msg.sessionId) as { id: number } | undefined
  if (conv) {
    const usage = message?.usage
    db.prepare(
      'INSERT INTO messages (conversation_id, message_id, role, content, tokens_input, tokens_output) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(conv.id, messageId, 'assistant', extractTextContent(message?.content), usage?.input ?? 0, usage?.output ?? 0)
  }
} catch (e) {
  console.warn('[message] failed to persist assistant message:', e)
}
```

**改动 6：** 用户消息也在发送时持久化：

在 `handleMessageSend` 开头，`session.prompt` 之前加：

```ts
// 持久化用户消息到 SQLite
try {
  const db = getDB()
  const conv = db.prepare('SELECT id FROM conversations WHERE session_id = ?').get(msg.sessionId) as { id: number } | undefined
  if (conv) {
    db.prepare(
      'INSERT INTO messages (conversation_id, message_id, role, content) VALUES (?, ?, ?, ?)',
    ).run(conv.id, `msg-user-${Date.now()}`, 'user', payload.content)
  }
} catch (e) {
  console.warn('[message] failed to persist user message:', e)
}
```

- [ ] **Step 1: 验证编译**

```bash
cd D:/claude/personal-agent/bridge && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add bridge/handlers/message.ts
git commit -m "feat: 消息持久化到 SQLite + 首轮 AI 自动命名"
```

---

### Task 5: bridge/index.ts 启动初始化 DB + 主会话

**Files:**
- Modify: `bridge/index.ts`

在 `console.log('[bridge] WebSocket server listening on...')` 前加：

```ts
import { initDB, getDB } from './db'

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

```

- [ ] **Step 1: 验证编译**

```bash
cd D:/claude/personal-agent/bridge && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add bridge/index.ts
git commit -m "feat: 启动时初始化 DB + 主会话「澪」"
```

---

### Task 6: 前端 useAgent.tsx — session 级缓存 + loadHistory

**Files:**
- Modify: `frontend/src/shell/useAgent.tsx`

改动要点：
1. 加 `sessionMessages` / `sessionToolCalls` Map
2. 加 `loadHistory()` 方法
3. `switchSession` 改为先加载历史再切信号
4. 暴露 `currentSid` signal（ChatRenderer 用它监听变化）

具体改动：

```ts
// 新增：session 级缓存
const sessionMessages = new Map<string, MessageEntry[]>()
const sessionToolCalls = new Map<string, ToolCallEntry[]>()

// loadHistory 函数（在 send 函数附近定义）
const loadHistory = (sid: string) => {
  // 发送 session.history 请求
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({
    type: 'session.history',
    id: crypto.randomUUID(),
    sessionId: sid,
    ts: Date.now(),
    payload: { sessionId: sid },
  }))
}

// 改 switchSession：
const switchSession = (sid: string) => {
  // 先缓存当前 session 的消息
  sessionMessages.set(currentSessionId(), messages())
  sessionToolCalls.set(currentSessionId(), toolCalls())
  
  // 切到新 session
  setCurrentSessionId(sid)
  
  // 如果有缓存直接用，没有则发 history 请求
  if (sessionMessages.has(sid)) {
    setMessages(sessionMessages.get(sid)!)
    setToolCalls(sessionToolCalls.get(sid) ?? [])
  } else {
    setMessages([])
    setToolCalls([])
  }
  
  send('session.switch', { sessionId: sid })
  if (!sessionMessages.has(sid)) {
    loadHistory(sid)
  }
}

// 扩展 session.created handler：对非主会话也做本地添加 + history 加载
// 扩展 session.history handler：
case 'session.history': {
  const sid = msg.payload.sessionId
  const msgs = msg.payload.messages as MessageEntry[]
  const tcs = (msg.payload.toolCalls ?? []) as ToolCallEntry[]
  sessionMessages.set(sid, msgs)
  sessionToolCalls.set(sid, tcs)
  if (currentSessionId() === sid) {
    setMessages(msgs)
    setToolCalls(tcs)
  }
  break
}

// 扩展 session.renamed handler：
case 'session.renamed':
  setSessions((prev) => prev.map((s) =>
    s.id === msg.payload.sessionId ? { ...s, title: msg.payload.title } : s
  ))
  break

// 扩展 session.deleted handler：
case 'session.deleted':
  setSessions((prev) => prev.filter((s) => s.id !== msg.payload.sessionId))
  sessionMessages.delete(msg.payload.sessionId)
  sessionToolCalls.delete(msg.payload.sessionId)
  break

// sendMessage 传入 user 消息时顺带更新 sessionMessages 缓存：
const sendMessage = (content: string) => {
  const userMsg: MessageEntry = {
    messageId: `msg-${crypto.randomUUID()}`,
    role: 'user',
    content,
    partial: false,
  }
  setMessages((prev) => {
    const next = [...prev, userMsg]
    sessionMessages.set(currentSessionId(), next)
    return next
  })
  send('message.send', { content })
}
```

- [ ] **Step 1: 验证编译**

```bash
cd D:/claude/personal-agent/frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/shell/useAgent.tsx
git commit -m "feat: useAgent 加入 session 级消息缓存 + loadHistory"
```

---

### Task 7: 前端 SessionPanel 重写

**Files:**
- Modify: `frontend/src/extensions/session-panel/SessionPanel.tsx`

完整重写为两层布局，组件代码：

```tsx
import { createSignal, For, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function SessionPanel() {
  const agent = useAgent()
  const [expanded, setExpanded] = createSignal(true)
  const [searchQuery, setSearchQuery] = createSignal('')
  const [deleteTarget, setDeleteTarget] = createSignal<string | null>(null)

  // 分离主会话和子会话
  const mainSession = () => agent.sessions().find((s) => s.id === agent.sessionId())
  const subSessions = () => {
    const q = searchQuery().toLowerCase()
    return agent.sessions().filter((s) => {
      if (s.id === mainSession()?.id) return false
      if (!q) return true
      return s.title.toLowerCase().includes(q) || s.id.includes(q)
    })
  }

  const handleDelete = (sid: string) => {
    if (deleteTarget() === sid) {
      agent.send('session.delete', { sessionId: sid })
      setDeleteTarget(null)
    } else {
      setDeleteTarget(sid)
    }
  }

  return (
    <div class="glass-panel session-panel" classList={{ expanded: expanded() }}>
      {/* 主会话头部 — 始终可见，点击进入澪 */}
      <div class="session-header" onClick={() => agent.switchSession(mainSession()!.id)}>
        <div class="avatar">🎐</div>
        <div class="meta">
          <div class="title">澪</div>
          <div class="time">
            最后活跃 {new Date(mainSession()?.lastActive ?? 0).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · 共 {mainSession()?.roundCount ?? 0} 轮对话
          </div>
        </div>
      </div>

      {/* 操作栏：新建 + 搜索 + 折叠箭头 */}
      <div class="sub-toolbar" style="display:flex;align-items:center;gap:8px;padding:0 16px;flex-shrink:0;">
        <button
          onClick={(e) => { e.stopPropagation(); agent.createSession() }}
          style={{background:'rgba(139,156,240,0.12)',border:'none',color:'var(--accent)',cursor:'pointer','border-radius':'6px',padding:'4px 8px','font-size':'13px'}}
          title="新建会话"
        >
          +
        </button>
        <input
          class="sub-search"
          type="text"
          placeholder="搜索会话..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          style="flex:1"
        />
        <span
          class="expand-arrow"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded()) }}
          style="cursor:pointer;font-size:10px;color:var(--text-secondary);flex-shrink:0;"
        >
          {expanded() ? '▼' : '▶'}
        </span>
      </div>

      {/* 子会话列表 — 可折叠 */}
      <div class="sub-sessions">
        <div class="sub-list">
          <For each={subSessions()}>
            {(s) => (
              <div
                class="sub-item"
                classList={{ active: s.id === agent.sessionId() }}
                style={{ position: 'relative' }}
                onClick={() => agent.switchSession(s.id)}
                onMouseEnter={(e) => { if (deleteTarget() !== s.id) (e.currentTarget.querySelector('.del-btn') as HTMLElement).style.opacity = '1' }}
                onMouseLeave={(e) => { if (deleteTarget() !== s.id) (e.currentTarget.querySelector('.del-btn') as HTMLElement).style.opacity = '0' }}
              >
                <span class="dot" />
                <span class="sub-title">{s.title}</span>
                <span class="sub-time" style={{'margin-right': '24px'}}>{s.roundCount}轮</span>
                <span
                  class="del-btn"
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    cursor: 'pointer', opacity: '0', transition: 'opacity 0.15s',
                    color: deleteTarget() === s.id ? '#f87171' : 'var(--text-muted)',
                    'font-size': '12px',
                  }}
                >
                  {deleteTarget() === s.id ? '确认?' : '×'}
                </span>
                {deleteTarget() === s.id && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(null) }}
                    style={{
                      position: 'absolute', right: '48px', top: '50%', transform: 'translateY(-50%)',
                      cursor: 'pointer', 'font-size': '11px', color: 'var(--text-muted)',
                    }}
                  >
                    取消
                  </span>
                )}
              </div>
            )}
          </For>
          <Show when={subSessions().length === 0}>
            <div class="sub-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
              <span class="sub-title" style="color:var(--text-muted)">无匹配会话</span>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 1: 验证编译**

```bash
cd D:/claude/personal-agent/frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/extensions/session-panel/SessionPanel.tsx
git commit -m "feat: SessionPanel 重写为澪+子会话两层布局 + 删除确认"
```

---

### Task 8: ChatRenderer + ToolPanel 跟随 session 切换

**Files:**
- Modify: `frontend/src/extensions/chat-renderer/ChatRenderer.tsx`
- Modify: `frontend/src/extensions/tool-panel/ToolPanel.tsx`

这两个组件的改动很小 —— 它们已经通过 `agent.messages()` 和 `agent.toolCalls()` 读取信号。Task 6 中 `switchSession` 已经调用 `setMessages` 和 `setToolCalls`，所以切换会话时聊天区和工具面板会自动更新。

**ChatRenderer 改动：** 确保切换会话后滚到底部

在 ChatRenderer 的 `createEffect` 中加入 sessionId 监听：

```ts
createEffect(() => {
  void agent.messages().length
  void agent.sessionId() // ← 加这行：session 切换时也触发滚动
  if (scrollRef) {
    scrollRef.scrollTop = scrollRef.scrollHeight
  }
})
```

**ToolPanel 改动：** 无需改动。`useAgent` 已从 `const agent = useAgent()` 改为访问 `agent.toolCalls()` signal，Task 6 切换会话时 `setToolCalls` 已更新。

- [ ] **Step 1: 验证编译**

```bash
cd D:/claude/personal-agent/frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/extensions/chat-renderer/ChatRenderer.tsx
git commit -m "feat: ChatRenderer 监听 sessionId 切换以正确滚动"
```

---

### Task 9: 端到端验证

- [ ] **Step 1: 重启 bridge**

```bash
# 终端 1
cd D:/claude/personal-agent/bridge && npx tsx --env-file ../.env index.ts
```

Expected: `[bridge] SQLite initialized at ~/.personal-agent/agent.db` + `主会话「澪」已创建: xxx-xxx`

- [ ] **Step 2: 前端 dev server**

```bash
# 终端 2
cd D:/claude/personal-agent/frontend && npm run dev
```

- [ ] **Step 3: 浏览器验证清单**

打开 `http://localhost:5173`：

- [ ] 会话面板显示「澪」为主会话（置顶）
- [ ] 点击「澪」头部分 → 聊天区显示（若为新会话则空）
- [ ] 点击 `+` 新建子会话 → 弹出 `session.created`，列表新增 `新会话 05-30`
- [ ] 在子会话中发一条消息 → AI 回复后标题自动变为摘要（如 `项目架构 05-30 2轮`）
- [ ] 切换到另一个子会话 → 发消息 → 再切回第一个 → 历史消息正确恢复
- [ ] 悬停子会话 → `×` 出现 → 点击 → `确认?` → 再次点击 → 会话删除
- [ ] 点击 `取消` → 删除取消
- [ ] 点击 `▼` 折叠子会话区 → 操作栏 + 列表隐藏 → 再次点击展开
- [ ] 重启 bridge → 「澪」仍在 → SQLite 数据持久

- [ ] **Step 4: Commit（如有微调）**

```bash
git add -A
git commit -m "chore: 端到端验证通过"
```
