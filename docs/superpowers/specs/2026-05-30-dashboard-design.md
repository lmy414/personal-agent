# Dashboard + 动态模型 & 上下文持久化 设计 Spec

> 日期: 2026-05-30 | 状态: 待实现

## 目标

1. 模型列表从 Pi modelRegistry 动态获取，消除所有硬编码
2. 上下文压缩手动按钮
3. contextWindow 从模型对象动态获取，不再硬编码 128000
4. 上下文用量持久化到 SQLite（每次 turn 结束写一条记录）
5. 对话中切换模型：仅空闲时允许，上下文不变，新模型 contextWindow 自动更新

---

## 协议改动

### 新增消息

**客户端 → 服务端**

```ts
// 手动压缩上下文
ClientMsg<'session.compact', {}>
```

**服务端 → 客户端**

```ts
// 压缩完成
ServerMsg<'session.compacted', { tokensBefore: number; tokensAfter: number; contextWindow: number }>
```

### 扩展已有消息

**`model.list` 响应** — 用 `status.update` 渠道扩展：

```ts
// status.update payload 新增字段
{ availableModels?: { id: string; name: string; contextWindow: number }[] }
```

**`status.update` / `session.state`** — `contextMax` 改为模型真实值（Pi 的 `model.contextWindow`），不再硬编码。

---

## 数据库

### 新表：`context_log`

```sql
CREATE TABLE IF NOT EXISTS context_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  used_tokens INTEGER NOT NULL DEFAULT 0,
  context_window INTEGER NOT NULL DEFAULT 0,
  percent REAL NOT NULL DEFAULT 0,
  model_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

每次 `agent_end` 写入一条，用于跨会话统计和后续分析面板。

---

## 桥接层

### 新 handler: `session.compact`

`bridge/handlers/session.ts`

```ts
export async function handleSessionCompact(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const session = getPiSession(msg.sessionId)
  if (!session) {
    ws.send(error(msg, 'SESSION_NOT_FOUND', '会话不存在'))
    return
  }
  if (session.isStreaming) {
    ws.send(error(msg, 'BUSY', '会话正在运行，无法压缩'))
    return
  }
  const before = session.getContextUsage()
  const result = await session.compact()
  const after = session.getContextUsage()
  ws.send({ type: 'session.compacted', payload: {
    tokensBefore: before?.tokens ?? 0,
    tokensAfter: after?.tokens ?? 0,
    contextWindow: after?.contextWindow ?? 0,
  }})
}
```

### 改造 `model.list` handler

```ts
export function handleModelList(msg: ClientMessage, ws: WebSocket): void {
  const session = getPiSession(msg.sessionId)
  const models = (session?.modelRegistry.getAll() ?? [])
    .filter(m => m.id && m.name)
    .map(m => ({ id: m.id ?? m.name, name: m.name, contextWindow: m.contextWindow ?? 0 }))
  ws.send({ type: 'status.update', payload: { availableModels: models } })
}
```

### 改造 `status.update` 组装

`message.ts` 的 `agent_end` 中：

```ts
// 原来写死 128000
const ctx = session.getContextUsage()
ws.send({ type: 'status.update', payload: {
  tokens: stats.tokens.total,
  cost: stats.cost,
  contextUsed: ctx?.tokens ?? 0,
  contextMax: ctx?.contextWindow ?? 128000,  // 动态取，留 128000 兜底
  roundCount: newRoundCount,
}})
```

同时写入 `context_log`：

```ts
if (ctx) {
  db.prepare('INSERT INTO context_log (session_id, used_tokens, context_window, percent, model_id) VALUES (?, ?, ?, ?, ?)')
    .run(msg.sessionId, ctx.tokens ?? 0, ctx.contextWindow, ctx.percent ?? 0, session.model?.id ?? '')
}
```

### 删除硬编码模型映射

`bridge/pi-session.ts` 的 `MODEL_MAP` 常量删除（或保留为 fallback 但不再作为主逻辑路径）。`resolveModel` 改为直接从 registry 查找匹配。

`bridge/pi-session.ts` 的 `getAvailableModels()` 改为完全从 registry 读取，删除 `Object.keys(MODEL_MAP)` 的 fallback 行。

---

## 前端层

### StatusBar 改造（变化最小化）

```
现有布局：
┌──────────────────────────────────┐
│ ⏱ 12:34:56          模型 [DeepSeek V3 ▼] │
│ 本次消耗  1,234 token         ≈ ¥0.0123  │
│ 上下文  12.8k / 128k    轮次  3          │
│ 上下文用量                          42%  │
└──────────────────────────────────┘

改动后：
┌──────────────────────────────────┐
│ ⏱ 12:34:56    模型 [动态列表 ▼]    ⟳ │
│ 本次消耗  1,234 token         ≈ ¥0.0123  │
│ 上下文  12.8k / 96k      轮次  3       │
│ 上下文用量                     42% ⟳   │
└──────────────────────────────────┘
```

1. **模型下拉** — `<select>` 的 `<option>` 改为从 `agent.status.availableModels` 渲染；无数据时用当前模型
2. **压缩按钮** — 上下文条右侧加一个字符 `⟳` 按钮，`isStreaming` 时灰色 + disabled
3. **contextMax** — 已经是读 `status.contextMax`，bridge 改完后自动生效
4. **模型下拉 disabled** — `isStreaming` 时禁用

### useAgent 新增

- `isStreaming` signal：`turn.start` → true，`turn.end` / `error` / `agent_end` → false
- 初始化时请求 `model.list`：WS `onopen` 后发送一次
- `status` store 新增 `availableModels?: { id: string; name: string; contextWindow: number }[]`

### 切换模型流程

1. 用户在下拉框选新模型
2. StatusBar 检查 `agent.isStreaming` — 如果正在流式播报则忽略
3. 调用 `switchModel(newModelId)`
4. Bridge `handleModelSwitch` 检查 `session.isStreaming`，空闲时调用 `session.setModel()`
5. Bridge 回复 `status.update`（含新 `contextMax`），前端 `setStatus` 自动刷新
6. 非空闲时返回 error `BUSY`

### model.list 响应合并安全性

`handleModelList` 发送 `{ type: 'status.update', payload: { availableModels } }`。
SolidJS `setStatus` 做 shallow merge，仅更新 `availableModels` 字段，不覆盖 `tokens`/`cost` 等已有字段。

---

## 硬编码清理清单

| 文件 | 要删除/修改的内容 |
|------|------------------|
| `bridge/pi-session.ts` | `MODEL_MAP` 常量（或改为仅注释保留）；`getAvailableModels` fallback 行 |
| `frontend/.../StatusBar.tsx` | `<option>` 硬编码列表，改为 `For` 动态渲染 |
| `bridge/handlers/message.ts` | `status.update` 中 `contextMax: 128000` 改为动态 |
| `bridge/handlers/message.ts` | `status.update` 中 `model` 字段从 Pi session.model.id 取 |
| `frontend/.../useAgent.tsx` | `StatusPayload.contextMax` 初始化 128000 → 0（等 bridge 推送） |
