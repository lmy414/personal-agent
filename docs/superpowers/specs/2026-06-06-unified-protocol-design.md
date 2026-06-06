# 统一协议设计 — Pi 全事件封装

> 2026-06-06 | 基于 pi-architecture-reference 分析

---

## 一、设计目标

```
扩展（前端 SolidJS）  ←───→  统一 WS 协议  ←───→  扩展（后端 Pi hooks）
                            │
                     Bridge（纯翻译层）
                     Pi 事件 ↔ 协议消息
```

- **一套协议**：前端组件和后端扩展使用相同的消息类型接入
- **Pi 全覆盖**：28 种 Agent/Harness 事件 + Agent 方法全部映射为协议消息
- **扩展只需读协议**：不 import Pi SDK，不 import useAgent——只 import 协议类型

---

## 二、消息信封（不变）

```typescript
// 所有消息共用信封
interface Envelope<T extends string, P = unknown> {
  type: T
  id: string          // 客户端生成，UUID
  sessionId: string   // 目标会话 ID
  ts: number          // 客户端时间戳
  payload: P
}
```

---

## 三、客户端 → 服务端（25 条）

### 3.1 会话管理（7）

| type | payload | Pi 对应 |
|------|---------|---------|
| `session.create` | `{ model?, thinkingLevel? }` | Harness.createSession() |
| `session.list` | `{}` | SessionRepo.list() |
| `session.switch` | `{ sessionId }` | Harness.loadSession() |
| `session.delete` | `{ sessionId }` | SessionRepo.delete() |
| `session.rename` | `{ sessionId, title }` | SessionRepo 标签 |
| `session.history` | `{ sessionId }` | Session.getEntries() |
| `session.state` | `{}` | Agent.state 查询 |

### 3.2 对话控制（3）

| type | payload | Pi 对应 |
|------|---------|---------|
| `agent.prompt` | `{ text, images? }` | Agent.prompt(text, images) |
| `agent.abort` | `{}` | Agent.abort() |
| `agent.compact` | `{}` | Harness.compact() |

### 3.3 配置控制（4）

| type | payload | Pi 对应 |
|------|---------|---------|
| `agent.model.set` | `{ modelId }` | Agent.setModel() |
| `agent.model.list` | `{}` | ModelRegistry 查询 |
| `agent.thinking.set` | `{ level: ThinkingLevel }` | Agent.setThinkingLevel() |
| `agent.tools.set` | `{ toolNames: string[] }` | Agent.setTools() 按 name 过滤 |

### 3.4 文件系统（3）

| type | payload | Pi 对应 |
|------|---------|---------|
| `file.list` | `{ path? }` | FileSystem.listDir() |
| `file.read` | `{ path, encoding? }` | FileSystem.readTextFile() / readBinaryFile() |
| `file.write` | `{ path, content }` | FileSystem.writeFile() |

### 3.5 设置（3）

| type | payload | Pi 对应 |
|------|---------|---------|
| `settings.get` | `{}` | SQLite 读取 |
| `settings.set` | `{ key, value }` | SQLite 写入 |
| `settings.discover` | `{}` | 模型发现 + 厂商扫描 |

### 3.6 记忆（2）

| type | payload | Pi 对应 |
|------|---------|---------|
| `memory.search` | `{ query }` | pa-mio 关键词检索 |
| `memory.list` | `{ limit?, offset? }` | pa-mio 全量列表 |

### 3.7 技能（4）

| type | payload | Pi 对应 |
|------|---------|---------|
| `skills.list` | `{}` | Skills 扫描 |
| `skills.install` | `{ zipPath, target }` | 解压 + 注册 |
| `skills.toggle` | `{ name, source, enabled }` | .disabled-skills.json |
| `skills.remove` | `{ name, source }` | 删除文件夹 |

### 3.8 心跳（1）

| type | payload | Pi 对应 |
|------|---------|---------|
| `ping` | `{}` | 免回复 noop |

---

## 四、服务端 → 客户端（22 条）

### 4.1 会话（4）

| type | payload |
|------|---------|
| `session.created` | `{ sessionId, model, thinkingLevel, createdAt }` |
| `session.list` | `{ sessions: SessionInfo[] }` |
| `session.deleted` | `{ sessionId }` |
| `session.renamed` | `{ sessionId, title }` |

### 4.2 Agent 生命周期 → Pi AgentEvent 直接映射（6）

| type | payload | Pi 事件 |
|------|---------|---------|
| `agent.start` | `{}` | `agent_start` |
| `agent.end` | `{ messages: AgentMessage[] }` | `agent_end` |
| `turn.start` | `{}` | `turn_start` |
| `turn.end` | `{ message, toolResults }` | `turn_end` |
| `turn.error` | `{ code, message, recoverable }` | 异常处理 |

### 4.3 消息流（3）

| type | payload | Pi 事件 |
|------|---------|---------|
| `message.start` | `{ messageId, role }` | `message_start` |
| `message.delta` | `{ messageId, delta, deltaType }` | `message_update` |
| `message.end` | `{ messageId, content }` | `message_end` |

### 4.4 工具执行（3）

| type | payload | Pi 事件 |
|------|---------|---------|
| `tool.start` | `{ toolCallId, toolName, input }` | `tool_execution_start` |
| `tool.progress` | `{ toolCallId, partialResult }` | `tool_execution_update` |
| `tool.end` | `{ toolCallId, toolName, result, isError }` | `tool_execution_end` |

### 4.5 状态同步（3）

| type | payload | 来源 |
|------|---------|------|
| `state.model` | `{ modelId, provider, previousModelId? }` | `model_update` |
| `state.thinking` | `{ level, previousLevel }` | `thinking_level_update` |
| `state.tools` | `{ toolNames, activeToolNames, previous* }` | `tools_update` |

### 4.6 文件（2）

| type | payload |
|------|---------|
| `file.list` | `{ path, entries: FileInfo[] }` |
| `file.content` | `{ path, content, language?, encoding? }` |

### 4.7 设置 & 技能（3）

| type | payload |
|------|---------|
| `settings.state` | `{ entries: { key, value }[] }` |
| `skills.state` | `{ skills: SkillSummary[], userSkillDir, projectSkillDir }` |
| `skills.installed` | `{ name, source }` |

### 4.8 记忆 & 压缩（2）

| type | payload |
|------|---------|
| `memory.results` | `{ query, entries: MemoryEntry[] }` |
| `memory.list` | `{ entries: MemoryEntry[], total }` |

### 4.9 事件——服务端推送（3）

| type | payload | Pi 事件 |
|------|---------|---------|
| `event.compacted` | `{ tokensBefore, tokensAfter, sessionId }` | `session_compact` |
| `event.compacting` | `{ details }` | `session_before_compact` |
| `event.context` | `{ messages }` | `context` |

---

## 五、协议统计

| 方向 | 条数 |
|------|------|
| Client → Server | 27 |
| Server → Client | 28 |
| **合计** | **55** |

当前 `protocol.ts` 只有 19 条消息，需新增 36 条。新增的主要是 Pi Agent/Harness 事件的直接映射。

---

## 六、Bridge 角色变化

```
现在：
  bridge/handlers/*.ts  ← 每个 handler 硬编码逻辑
  bridge/dispatcher.ts  ← 手动路由表

改造后：
  bridge/
  ├── protocol.ts        ← 55 条消息的完整类型定义
  ├── pi-adapter.ts      ← Pi 事件 → 协议消息（纯翻译）
  ├── ws-relay.ts         ← WS ↔ 协议双向转发
  └── plugins/            ← 扩展通过协议钩子接入
      ├── pa-mio/         ←   prompt hooks + memory tools
      ├── pa-files/       ←   file tools
      └── pa-mcp/         ←   MCP 桥接
```

**pi-adapter.ts 核心逻辑（~60 行）：**

```typescript
export function createPiAdapter(agent: HarnessSession, broadcast: (msg: ServerMessage) => void) {
  agent.on('agent_start', () => broadcast({ type: 'agent.start', payload: {} }))
  agent.on('agent_end', (e) => broadcast({ type: 'agent.end', payload: { messages: e.messages } }))
  agent.on('turn_start', () => broadcast({ type: 'turn.start', payload: {} }))
  agent.on('turn_end', (e) => broadcast({ type: 'turn.end', payload: { message: e.message, toolResults: e.toolResults } }))
  agent.on('message_start', (e) => broadcast({ type: 'message.start', payload: { messageId: e.message.id, role: e.message.role } }))
  agent.on('message_update', (e) => broadcast({ type: 'message.delta', payload: { messageId: e.message.id, delta: e.assistantMessageEvent.delta, deltaType: e.assistantMessageEvent.type } }))
  agent.on('message_end', (e) => broadcast({ type: 'message.end', payload: { messageId: e.message.id, content: e.message.content } }))
  agent.on('tool_execution_start', (e) => broadcast({ type: 'tool.start', payload: { toolCallId: e.toolCallId, toolName: e.toolName, input: e.args } }))
  agent.on('tool_execution_update', (e) => broadcast({ type: 'tool.progress', payload: { toolCallId: e.toolCallId, partialResult: e.partialResult } }))
  agent.on('tool_execution_end', (e) => broadcast({ type: 'tool.end', payload: { toolCallId: e.toolCallId, toolName: e.toolName, result: e.result, isError: e.isError } }))
}
```

**前端扩展消费（纯协议类型，不 import useAgent 的内部）：**

```typescript
// 扩展只需 import 协议类型
import type { ServerMessage } from '@bridge/protocol'

// 通过 useAgent().subscribe() 消费（现有的 subscribe 机制不变）
const unsub = agent.subscribe('tool.start', (msg) => { ... })
```

---

## 七、实施步骤

| Step | 内容 | 改动 |
|------|------|------|
| 1 | `protocol.ts` — 补全 55 条消息类型定义 | protocol.ts +130 行 |
| 2 | `pi-adapter.ts` — 新建 Pi 事件翻译器 | 新文件 ~60 行 |
| 3 | `pi-session.ts` — 接入 adapter，移除手动映射 | 改 ~40 行 |
| 4 | `dispatcher.ts` — 补全客户端消息路由 | +15 行 |
| 5 | 验证 `npm run check` + 手动测试 | — |

**不改的部分：** 前端 `useAgent.tsx`、所有扩展组件——它们通过现有的 `subscribe()` + `send()` 接口工作，底层消息类型增加不影响上层。

---

*本文档为统一协议设计 spec，后续实施 plan 将据此分解任务。*
