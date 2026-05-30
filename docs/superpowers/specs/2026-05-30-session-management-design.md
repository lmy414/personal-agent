# 会话管理完善 — 设计 Spec

> 2026-05-30 | 会话切换 · 历史持久化 · 自动命名 · 主会话「澪」· 删除确认

## 目标

完善会话全生命周期：主会话「澪」（不可删除）、子会话管理（切换/删除/自动命名）、历史消息持久化与恢复。

## 协议新增

```
前端 → 后端
session.history    { sessionId }                          ← 加载历史消息 + 工具调用
session.rename     { sessionId, title }                   ← 重命名会话
session.delete     { sessionId }                          ← 级联删除

后端 → 前端
session.history    { sessionId, messages: MessageEntry[], toolCalls: ToolCallEntry[] }
session.renamed    { sessionId, title }
session.deleted    { sessionId }
```

## 主会话「澪」

- 默认会话，`sessionId` 持久化在 settings 表（首次启动自动创建）
- 不可删除（删除 handler 返回 error）
- session.list 始终置顶
- 标题固定为「澪」，显示最后活跃日期 + 轮次

## 会话面板布局

```
┌──────────────────────────┐
│ 🎐 澪                     │  ← 主会话头部，点击 → switchSession
│    最后活跃 14:32 · 4轮    │     始终可见，不可折叠
├──────────────────────────┤
│ [+] 新建  🔍 搜索...   ▼  │  ← 操作栏，▼控制子列表折叠
├──────────────────────────┤
│ ○ 项目架构 05-29 · 3轮    │  ← 子会话列表（可折叠）
│ ○ Blender材质 05-28 · 2轮 │     悬停显示 × 删除
│ ○ DeepSeek调试 05-27 · 5轮│
└──────────────────────────┘
```

**交互规则：**
- 点击主会话头部 → `switchSession(澪的id)`，不触发折叠
- 点击 ▼ 箭头 → 折叠/展开子会话区（操作栏 + 列表）
- 新建按钮 `+` 在操作栏左侧
- 子会话条目点击 → 切换到该会话 + 加载历史
- 悬停子会话条目 → 出现 `×` 删除按钮
- 点击 `×` → 条目内联弹出确认：[确认删除] [取消]
- 确认后 → `session.delete` → 从列表移除

## 子会话标题格式

```
{AI总结标题} {最近活跃日期} {N}轮

示例：
  项目架构讨论 05-30 3轮
  Blender材质调试 05-28 2轮
```

- 创建时临时标题：`新会话 05-30`
- 首轮对话完成后（roundCount===1 后变 2），触发 AI 摘要
- AI 摘要调用 DeepSeek，取最近 2 条消息（user+assistant），3-5 字主题
- 摘要后推送 `session.renamed`
- 后续轮次仅更新日期和轮次数字，标题不变

## 会话切换流程

```
前端 switchSession(sid)
  → bridge session.switch 返回 session.state (contextUsed, roundCount, model)
  → 前端发 session.history { sessionId: sid }
  → bridge 查 SQLite:
       SELECT m.role, m.content, m.created_at
       FROM messages m JOIN conversations c ON m.conversation_id = c.id
       WHERE c.session_id = ? ORDER BY m.id ASC
       同时查 tool_calls:
       SELECT tool_call_id, tool_name, input, output, status, duration
       FROM tool_calls WHERE session_id = ? ORDER BY created_at ASC
  → 返回 messages[] + toolCalls[]
  → 前端填充 messages 信号 + toolCalls 信号
  → 聊天区显示完整历史，工具面板显示历史调用
```

## 数据库

现有 `conversations` 和 `messages` 表（pa-sqlite 已建）。需新增：

```sql
-- tool_calls 表（新建）
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

-- settings 表（pa-sqlite 已有），初始化时写入主会话 id
INSERT OR IGNORE INTO settings (key, value) VALUES ('main_session_id', '<sid>');
```

Bridge 不加载 Pi 扩展，直接用 better-sqlite3 读写同一数据库（`~/.personal-agent/agent.db`）。

## Bridge handler 改动

| Handler | 改动 |
|---------|------|
| `session.create` | 已实现，不变 |
| `session.list` | 合并 Pi 内存会话 + SQLite 持久化会话，id 去重，「澪」置顶 |
| `session.switch` | 已实现，不变（返回 session.state） |
| `session.history` | **新建**，查 SQLite 返回 messages + toolCalls |
| `session.rename` | **新建**，UPDATE conversations SET title |
| `session.delete` | 增强：级联删 conversations + messages + tool_calls，禁删「澪」 |
| `message.send` | 增强：turn.end 后检查 roundCount===1，调 AI 摘要，更新 SQLite，推送 session.renamed |
| `tool.start` | 增强：写入 tool_calls 表 |
| `tool.end` | 增强：更新 tool_calls 表 output/status/duration |

## 前端改动

| 文件 | 改动 |
|------|------|
| `SessionPanel.tsx` | 重写布局：主会话头部 + 操作栏 + 子会话列表 |
| `useAgent.tsx` | 新增 `messages` / `toolCalls` 按 sessionId 缓存；`loadHistory()` 方法 |
| `ChatRenderer.tsx` | 切换会话时接收历史消息加载 |
| `ToolPanel.tsx` | 切换会话时接收历史工具调用加载 |
| 新增内联删除确认 | SessionPanel 内处理 |

## 约束

- 不加载 Pi 扩展（pa-sqlite），bridge 直接 better-sqlite3 读写
- 前端不直接访问 SQLite
- 现有扩展机制不修改
- 消息 ID 用 bridge 生成的 messageId，存 messages 表
