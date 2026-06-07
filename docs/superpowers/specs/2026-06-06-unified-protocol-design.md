# 统一协议设计 — 实施后文档

> 2026-06-08 | 匹配实际 69 条消息 + 多智能体架构 | 原 Spec: 2026-06-06

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
- **类型安全 subscribe**：`subscribe<T>(type, handler)` 泛型自动推导 payload 类型

---

## 二、消息信封（不变）

```typescript
interface Envelope<T extends string, P = unknown> {
  type: T
  id: string          // 客户端生成，UUID
  sessionId: string   // 目标会话 ID
  ts: number          // 客户端时间戳
  payload: P
}
```

---

## 三、客户端 → 服务端（33 条）

### 3.0 智能体管理（6）— 多智能体架构

| type | payload | 说明 |
|------|---------|------|
| `agent.list` | `{}` | 列出所有智能体 |
| `agent.create` | `{ name, provider, modelId, avatarColor?, roleDescription? }` | 创建智能体 |
| `agent.update` | `{ agentId, name?, avatarColor?, roleDescription? }` | 更新智能体 |
| `agent.delete` | `{ agentId }` | 删除智能体 |
| `agent.switch` | `{ agentId }` | 切换当前智能体 |
| `agent.set_default` | `{ agentId }` | 设为默认智能体 |

### 3.1 会话管理（7）

| type | payload | 说明 |
|------|---------|------|
| `session.create` | `{ model?, thinkingLevel?, agentId? }` | 创建会话 |
| `session.list` | `{ agentId? }` | 列出会话（可按智能体过滤） |
| `session.switch` | `{ sessionId }` | 切换当前会话 |
| `session.delete` | `{ sessionId }` | 删除会话 |
| `session.rename` | `{ sessionId, title }` | 重命名会话 |
| `session.history` | `{ sessionId }` | 加载历史消息 + 工具调用 |
| `session.state` | `{}` | 查询当前会话状态 |

### 3.2 对话控制（3）

| type | payload | 说明 |
|------|---------|------|
| `agent.prompt` | `{ content, displayContent?, attachments?, images? }` | 发送消息 |
| `agent.abort` | `{}` | 中断当前回复 |
| `agent.compact` | `{}` | 压缩上下文 |

### 3.3 配置控制（4）

| type | payload | 说明 |
|------|---------|------|
| `agent.model.set` | `{ modelId }` | 切换模型 |
| `agent.model.list` | `{}` | 列出可用模型 |
| `agent.thinking.set` | `{ level: ThinkingLevel }` | 设置思考深度 |
| `agent.tools.set` | `{ toolNames: string[] }` | 设置启用工具 |

### 3.4 文件系统（3）

| type | payload | 说明 |
|------|---------|------|
| `file.list` | `{ path? }` | 列出目录 |
| `file.read` | `{ path, encoding? }` | 读取文件 |
| `file.write` | `{ path, content }` | 写入文件 |

### 3.5 设置（3）

| type | payload | 说明 |
|------|---------|------|
| `settings.get` | `{}` | 读取所有设置 |
| `settings.set` | `{ key, value }` | 写入设置 |
| `settings.discover` | `{}` | 发现可用模型 |

### 3.6 记忆（2）

| type | payload | 说明 |
|------|---------|------|
| `memory.search` | `{ query }` | 关键词搜索记忆 |
| `memory.list` | `{ limit?, offset? }` | 分页列出记忆 |

### 3.7 技能（4）

| type | payload | 说明 |
|------|---------|------|
| `skills.list` | `{}` | 列出已安装技能 |
| `skills.install` | `{ zipPath, target }` | 安装技能 |
| `skills.toggle` | `{ name, source, enabled }` | 启用/禁用技能 |
| `skills.remove` | `{ name, source, dirName }` | 移除技能 |

### 3.8 心跳（1）

| type | payload | 说明 |
|------|---------|------|
| `ping` | `{}` | 免回复 noop |

---

## 四、服务端 → 客户端（36 条）

### 4.0 智能体事件（5）— 多智能体架构

| type | payload |
|------|---------|
| `agent.list` | `{ agents: AgentInfo[] }` |
| `agent.created` | `{ agent: AgentInfo }` |
| `agent.updated` | `{ agent: AgentInfo }` |
| `agent.deleted` | `{ agentId }` |
| `agent.default_changed` | `{ agentId }` |

### 4.1 会话（6）

| type | payload |
|------|---------|
| `session.created` | `{ sessionId, model, thinkingLevel, createdAt, agentId? }` |
| `session.list` | `{ sessions: SessionInfo[] }` |
| `session.renamed` | `{ sessionId, title }` |
| `session.deleted` | `{ sessionId }` |
| `session.history` | `{ sessionId, messages, toolCalls }` |
| `session.state` | `{ model, thinkingLevel, contextUsed, contextMax, roundCount, tokens?, cost?, agentId? }` |

### 4.2 Agent 生命周期（5）— Pi AgentEvent 直接映射

| type | payload | Pi 事件 |
|------|---------|---------|
| `agent.start` | `{}` | `agent_start` |
| `agent.end` | `{ messages }` | `agent_end` |
| `turn.start` | `{ turnIndex }` | `turn_start` |
| `turn.end` | `{ turnIndex, usage, cost }` | `turn_end` |
| `turn.error` | `{ code, message, recoverable }` | 异常处理 |

### 4.3 消息流（3）

| type | payload | Pi 事件 |
|------|---------|---------|
| `message.start` | `{ messageId, role }` | `message_start` |
| `message.delta` | `{ messageId, delta, deltaType }` | `message_update` |
| `message.end` | `{ messageId, content, usage }` | `message_end` |

### 4.4 工具执行（3）

| type | payload | Pi 事件 |
|------|---------|---------|
| `tool.start` | `{ toolCallId, toolName, input }` | `tool_execution_start` |
| `tool.progress` | `{ toolCallId, output }` | `tool_execution_update` |
| `tool.end` | `{ toolCallId, toolName, output, duration, status, isError }` | `tool_execution_end` |

### 4.5 状态同步（4）

| type | payload | 来源 |
|------|---------|------|
| `state.model` | `{ modelId, provider, previousModelId? }` | `model_update` |
| `state.thinking` | `{ level, previousLevel }` | `thinking_level_update` |
| `state.tools` | `{ toolNames, activeToolNames, previous* }` | `tools_update` |
| `status.update` | `{ tokens, cost, contextUsed, contextMax, roundCount, model?, availableModels? }` | `turn_end` 聚合 |

### 4.6 文件（3）

| type | payload |
|------|---------|
| `file.list` | `{ path, entries: FileEntry[] }` |
| `file.content` | `{ path, content, language?, encoding? }` |
| `file.changed` | `{ path }` — 文件监听变更通知 |

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
| `session.compacted` | `{ tokensBefore, tokensAfter, tokensSaved, contextWindow }` |

### 4.9 系统（1）

| type | payload |
|------|---------|
| `error` | `{ code, message, recoverable }` |

---

## 五、协议统计

| 方向 | 条数 |
|------|------|
| Client → Server | 33 |
| Server → Client | 36 |
| **合计** | **69** |

---

## 六、当前 Bridge 架构（2026-06-08）

```
bridge/
├── index.ts               ← 入口：WSS + 启动编排（53 行）
├── init-db.ts             ← DB + 主会话 + 默认设置
├── init-config.ts         ← .pi/settings.json 生成
├── init-agents.ts         ← Agent 自动发现
├── protocol.ts            ← 69 条消息完整类型定义 + ExtractPayload<T>
├── dispatcher.ts          ← 32 路由（ClientMessage → handler）
├── pi-session.ts          ← Pi SDK 会话管理
├── pi-adapter.ts          ← Pi 事件 → 协议消息 纯翻译器
├── db.ts                  ← SQLite 持久化
├── watcher.ts             ← 文件监听 + 广播
├── client-manager.ts      ← 统一客户端集（add/remove/broadcast）
├── auto-name.ts           ← DeepSeek AI 自动命名服务
└── handlers/              ← 11 文件按消息域拆分
    ├── settings.ts, file.ts, session.ts, message.ts
    ├── model.ts, memory.ts, memory-store.ts
    ├── skills.ts, agent.ts, thinking.ts, tools.ts
```

---

## 七、实施状态

| Step | 内容 | 状态 |
|------|------|------|
| 1 | `protocol.ts` — 69 条消息类型定义 | ✅ 完成 |
| 2 | `pi-adapter.ts` — Pi 事件翻译器 | ✅ 完成 |
| 3 | `dispatcher.ts` — 32 路由 | ✅ 完成 |
| 4 | 前端 subscribe 泛型化 | ✅ P3-1 完成 |
| 5 | Bridge 启动拆分 (init-db/config/agents) | ✅ P3-2 完成 |
| 6 | Handler 业务逻辑分离 (auto-name) | ✅ P3-3 完成 |
| 7 | 客户端管理统一 (client-manager) | ✅ P3-4 完成 |

---

*本文档为统一协议设计 spec，2026-06-08 更新至实施后状态。*
