# Pi 架构参考 & 插件系统设计基础

> 2026-06-06 | 基于 vendor/pi 源码分析

---

## 一、Pi 架构概览

```
┌──────────────────────────────────────────────────────┐
│ AgentHarness (agent-harness.ts)                      │
│ · Session 持久化 (JSONL / Memory)                    │
│ · Skills / Prompt Templates 管理                     │
│ · Compaction / Branch Summary                        │
│ · FileSystem + Shell 抽象                            │
│ · ~28 种事件 (AgentEvent + HarnessOwnEvent)          │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Agent (agent.ts)                                  │ │
│ │ · 状态管理（messages, tools, model, thinking）    │ │
│ │ · 流式循环（prompt → LLM → tool → prompt → ...） │ │
│ │ · 队列（steering / followUp）                     │ │
│ │ · subscribe(listener) → AgentEvent                │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 二、Agent 核心事件 (AgentEvent)

`vendor/pi/packages/agent/src/types.ts:403-418`

| # | 事件 | 触发时机 | Payload |
|---|------|---------|---------|
| 1 | `agent_start` | 新一轮对话开始 | `{}` |
| 2 | `agent_end` | 本轮结束，返回新消息 | `{ messages: AgentMessage[] }` |
| 3 | `turn_start` | 一次 LLM provider 请求开始 | `{}` |
| 4 | `turn_end` | LLM 请求完成，工具也已执行完 | `{ message: AgentMessage, toolResults: ToolResultMessage[] }` |
| 5 | `message_start` | 任何消息进入上下文 | `{ message: AgentMessage }` |
| 6 | `message_update` | assistant 流式增量（每 token） | `{ message: AgentMessage, assistantMessageEvent }` |
| 7 | `message_end` | 消息完成 | `{ message: AgentMessage }` |
| 8 | `tool_execution_start` | 工具开始执行 | `{ toolCallId, toolName, args }` |
| 9 | `tool_execution_update` | 工具执行中进度 | `{ toolCallId, toolName, args, partialResult }` |
| 10 | `tool_execution_end` | 工具执行完毕 | `{ toolCallId, toolName, result, isError }` |

### Agent 公开接口

```typescript
class Agent {
  // 状态（只读）
  state: AgentState  // { systemPrompt, model, thinkingLevel, tools, messages, isStreaming, ... }

  // 方法
  prompt(text: string, images?: ImageContent[]): Promise<void>  // 发起对话
  setModel(model: Model<any>): void
  setThinkingLevel(level: ThinkingLevel): void
  setTools(tools: AgentTool[]): void
  discardTools(toolCallIds: string[]): void
  abort(): Promise<AbortResult>                                  // 中止当前运行

  // 队列
  enqueueSteering(message: AgentMessage): void
  enqueueFollowUp(message: AgentMessage): void

  // 事件
  subscribe(listener: (event: AgentEvent, signal: AbortSignal) => void | Promise<void>): () => void
}
```

---

## 三、AgentHarness 扩展事件 (AgentHarnessOwnEvent)

`vendor/pi/packages/agent/src/harness/types.ts:634-656`

### 队列管理

| 事件 | 说明 |
|------|------|
| `queue_update` | 队列变更 `{ steer, followUp, nextTurn }` |
| `abort` | 中止时清空队列 `{ clearedSteer, clearedFollowUp }` |
| `settled` | 本轮彻底结束 `{ nextTurnCount }` |

### 上下文注入

| 事件 | 说明 |
|------|------|
| `before_agent_start` | agent_start 前，可修改 prompt + systemPrompt |
| `context` | 上下文快照 `{ messages }` |

### Provider 生命周期

| 事件 | 说明 |
|------|------|
| `before_provider_request` | 发请求前，可改 streamOptions |
| `before_provider_payload` | payload 组装后，可修改整个 payload |
| `after_provider_response` | 收到响应后 `{ status, headers }` |

### 工具增强

| 事件 | 说明 |
|------|------|
| `tool_call` | 工具调用前，可 block `{ toolCallId, toolName, input }` |
| `tool_result` | 工具完成后，可修改结果 `{ content, details, isError }` |

### 会话管理

| 事件 | 说明 |
|------|------|
| `model_update` | 模型变更 `{ model, previousModel, source }` |
| `thinking_level_update` | 思考等级变更 |
| `tools_update` | 工具集变更 `{ toolNames, activeToolNames }` |
| `resources_update` | 资源（skills/templates）变更 |
| `save_point` | 保存点 `{ hadPendingMutations }` |

### 压缩 & 分支

| 事件 | 说明 |
|------|------|
| `session_before_compact` | 压缩前，可取消或自定义 summary |
| `session_compact` | 压缩完成 `{ compactionEntry, fromHook }` |
| `session_before_tree` | 分支摘要前 |
| `session_tree` | 分支摘要完成 |

---

## 四、AgentTool 定义

`vendor/pi/packages/agent/src/types.ts:361-384`

```typescript
interface AgentTool<TParameters, TDetails = any> {
  name: string              // LLM 可见的工具名
  description: string       // LLM 可读的描述
  label: string             // UI 显示名
  schema: TParameters       // TypeBox schema，定义参数结构
  execute: (toolCallId: string, params: Static<TParameters>, signal?: AbortSignal, onUpdate?: AgentToolUpdateCallback<TDetails>) => Promise<AgentToolResult<TDetails>>
  prepareArguments?: (args: unknown) => Static<TParameters>  // 参数预处理
  executionMode?: "sequential" | "parallel"                  // 工具执行模式
}

interface AgentToolResult<T> {
  content: (TextContent | ImageContent)[]  // 返回给 LLM
  details: T                               // 结构化详情（供 UI/hook）
  terminate?: boolean                      // 提前终止
}
```

---

## 五、AgentHarness 插件 Hook 点

`vendor/pi/packages/agent/src/harness/types.ts:798-831`

```typescript
interface AgentHarnessOptions {
  env: ExecutionEnv          // 文件系统 + Shell
  session: Session           // 持久化会话
  tools?: AgentTool[]        // 工具注册
  resources?: AgentHarnessResources  // Skills + Prompt Templates
  systemPrompt?: string | ((context) => string)  // 可动态生成
  getApiKeyAndHeaders?: (model) => Promise<{ apiKey, headers }>
  streamOptions?: AgentHarnessStreamOptions
  model: Model<any>
  thinkingLevel?: ThinkingLevel
  activeToolNames?: string[]  // 按 name 过滤激活的工具
  steeringMode?: QueueMode    // "all" | "one-at-a-time"
  followUpMode?: QueueMode
}
```

**每个 hook 都可以是一个函数——这就是插件接入点：**

1. **`tools`** — 注册工具（pa-files 的文件 list/read 工具）
2. **`systemPrompt`** — 动态组装 prompt（pa-mio 的人格注入）
3. **`resources.skills`** — 技能注册（skills 管理系统）
4. **`streamOptions`** — provider 请求控制
5. **`beforeToolCall` / `afterToolCall`** — 工具拦截/修改

---

## 六、当前 bridge 映射状态

`bridge/protocol.ts` 现有映射（19 条消息）：

| WS 消息 | 方向 | Pi 能力 |
|---------|------|---------|
| `message.send` | C→S | Agent.prompt() |
| `message.cancel` | C→S | Agent.abort() |
| `model.switch` | C→S | Agent.setModel() |
| `model.list` | C→S | modelRegistry |
| `session.create` | C→S | Harness.createSession() |
| `session.list` | C→S | Harness.listSessions() |
| `session.switch` | C→S | Harness.loadSession() |
| `session.delete` | C→S | Harness.deleteSession() |
| `session.history` | C→S | Session.getEntries() |
| `session.state` | C→S → C | Agent.state 查询 |
| `file.list` | C→S | FileSystem.listDir() |
| `file.read` | C→S | FileSystem.readTextFile() |
| `memory.search` | C→S | pa-mio memory_store |
| `memory.list` | C→S | pa-mio memory_store |
| `settings.get/set` | C→S | SQLite |
| `skills.*` (4) | C→S | Skills 管理 |
| `turn.start/end` | S→C | AgentEvent |
| `message.start/delta/end` | S→C | AgentEvent |
| `tool.start/progress/end` | S→C | AgentEvent |
| `status.update` | S→C | 自定义聚合 |
| `error` | S→C | 通用错误 |
| `ping` | C→S | 心跳 |

---

## 七、插件化设计方向

目标：**一个插件 = 一个文件夹，声明即注册，删即卸载。**

```typescript
// 插件接口（草案）
interface Plugin {
  id: string
  name: string
  
  // === 后端能力 ===
  tools?: AgentTool[]                    // 注册到 Harness
  promptHooks?: {                        // system prompt 注入
    layer: number                        // 排序层
    generate: (ctx: PromptContext) => string
  }
  eventHooks?: {                         // 监听 Harness 事件
    event: AgentHarnessEvent['type']
    handler: (event: any) => void | Promise<void>
  }
  
  // === 前端能力 ===
  ui?: {
    slots?: { slot: SlotId; component: Component; label?: string }[]  // 现有扩展机制
    settingsPage?: { tab: string; icon: Component; component: Component }
  }
  
  // === 协议扩展 ===
  protocolMessages?: {
    clientToServer?: Record<string, (payload: any) => void>
    serverToClient?: string[]
  }
}
```

**pa-mio 作为参考实现：**
- tools: `memory_add`, `memory_read`（2 个 AgentTool）
- promptHooks: Layer 0 SOUL.md + Layer 1 记忆快照 + Layer 2.5 工作目录
- eventHooks: 无（工具已注册，prompt 已注入）
- 无前端 UI

**pa-files 作为参考实现：**
- tools: `list_directory`, `preview_file`（2 个 AgentTool）
- 无 prompt hooks
- 无前端 UI

---

## 八、下一步

1. **定义 Plugin 接口** — 基于上述分析，设计正式 TypeScript 接口
2. **重构 bridge/pi-session.ts** — 改为插件发现 + 注册机制
3. **统一前后端注册** — 一个 plugin 声明同时注册后端能力 + 前端 UI
4. **迁移现有扩展** — pa-mio、pa-files 迁移到新接口
5. **协议文档化** — protocol.ts 补全所有 Pi 事件映射

---

*本文档为 Pi 架构参考，后续设计 spec 将基于此文档。*
