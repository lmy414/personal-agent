# Pi Agent Frontend API 规范

> ⚠️ **已过时** — 本文件为早期设计草案。实际协议定义见 `bridge/protocol.ts`，
> 消息路由表见 `bridge/dispatcher.ts`。端口为 9229（非 8080），EchoBot 已移除。

> 版本: v0.1.0  
> 协议: WebSocket (JSON)  
> 适用: 三栏式角色聊天前端 ↔ Node.js Pi SDK 桥接层

---

## 1. 架构

```
┌─────────────────────┐         ┌─────────────────────────────┐
│   前端 (Browser)     │  ←──→   │   Node.js Bridge Server      │
│   React/Vue/Solid    │  WS     │   ┌─────────────────────┐   │
│                     │  :8080   │   │  Pi SDK             │   │
│   三栏 UI            │         │   │  createAgentSession │   │
│   - 左侧会话/文件    │         │   │  session.subscribe  │   │
│   - 中间对话区       │         │   └─────────────────────┘   │
│   - 右侧预览/扩展    │         └─────────────────────────────┘
└─────────────────────┘
```

前端通过 **WebSocket** 连接到 Node.js 桥接层。桥接层内部持有 `AgentSession` 实例，负责将 Pi SDK 的事件流转发给前端，并将前端命令转译成 SDK 调用。

---

## 2. 连接

### 2.1 建立连接

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  // 连接成功，发送初始化请求
  ws.send(JSON.stringify({ type: 'init', clientVersion: '0.1.0' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  handleMessage(msg);
};
```

### 2.2 消息格式

所有消息均为 JSON，顶层结构：

```typescript
interface WsMessage {
  id?: string;        // 可选，用于请求/响应关联
  type: string;       // 消息类型
  payload?: unknown;  // 负载数据
  error?: string;     // 错误信息（仅在错误时出现）
}
```

三种消息模式：

| 模式 | 方向 | 说明 |
|------|------|------|
| **Request** | 前端 → 后端 | 发送命令，如发送消息、切换模型 |
| **Response** | 后端 → 前端 | 对 Request 的确认或结果返回 |
| **Event** | 后端 → 前端 | 服务端主动推送，如 token 流、工具调用 |

---

## 3. 前端 → 后端 命令 (Request)

### 3.1 消息输入

#### `chat.send`
发送用户消息，触发 LLM 调用。

```json
{
  "id": "req-1",
  "type": "chat.send",
  "payload": {
    "text": "帮我看一下项目结构",
    "images": [],
    "mode": "normal"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | ✅ | 用户输入文本 |
| `images` | ImageContent[] | ❌ | 图片附件（base64）|
| `mode` | string | ❌ | `normal` / `steer` / `followUp`，默认 `normal` |

#### `chat.steer`
流式模式下插队（中断当前输出，立即执行新指令）。

```json
{
  "id": "req-2",
  "type": "chat.steer",
  "payload": {
    "text": "停，先别管这个"
  }
}
```

#### `chat.followUp`
流式模式下排队（等当前输出结束后执行）。

```json
{
  "id": "req-3",
  "type": "chat.followUp",
  "payload": {
    "text": "然后再看看配置文件"
  }
}
```

---

### 3.2 会话控制

#### `session.new`
创建新会话。

```json
{
  "id": "req-4",
  "type": "session.new",
  "payload": {
    "name": "代码审查",
    "parentSession": null
  }
}
```

#### `session.switch`
切换到已有会话。

```json
{
  "id": "req-5",
  "type": "session.switch",
  "payload": {
    "sessionPath": "/path/to/session.jsonl"
  }
}
```

#### `session.fork`
从指定消息分叉新会话。

```json
{
  "id": "req-6",
  "type": "session.fork",
  "payload": {
    "entryId": "msg-uuid",
    "position": "at"
  }
}
```

#### `session.rename`
重命名当前会话。

```json
{
  "id": "req-7",
  "type": "session.rename",
  "payload": {
    "name": "新的会话名称"
  }
}
```

#### `session.compact`
手动触发上下文压缩。

```json
{
  "id": "req-8",
  "type": "session.compact",
  "payload": {
    "customInstructions": "保留项目结构相关的讨论"
  }
}
```

#### `session.export`
导出会话为 HTML。

```json
{
  "id": "req-9",
  "type": "session.export",
  "payload": {
    "outputPath": "./exports/chat.html"
  }
}
```

---

### 3.3 模型控制

#### `model.set`
切换模型。

```json
{
  "id": "req-10",
  "type": "model.set",
  "payload": {
    "provider": "anthropic",
    "modelId": "claude-sonnet-4-20250514"
  }
}
```

#### `model.cycle`
循环切换模型。

```json
{
  "id": "req-11",
  "type": "model.cycle",
  "payload": {
    "direction": "forward"
  }
}
```

#### `model.list`
获取可用模型列表。

```json
{
  "id": "req-12",
  "type": "model.list"
}
```

#### `thinking.set`
设置思考级别。

```json
{
  "id": "req-13",
  "type": "thinking.set",
  "payload": {
    "level": "high"
  }
}
```

---

### 3.4 工具与扩展

#### `tools.setActive`
设置激活的工具列表。

```json
{
  "id": "req-14",
  "type": "tools.setActive",
  "payload": {
    "toolNames": ["read", "bash", "edit", "my_custom_tool"]
  }
}
```

#### `tools.list`
获取所有可用工具。

```json
{
  "id": "req-15",
  "type": "tools.list"
}
```

#### `extension.command`
执行扩展注册的命令。

```json
{
  "id": "req-16",
  "type": "extension.command",
  "payload": {
    "name": "usage",
    "args": ""
  }
}
```

#### `extension.reload`
重新加载所有扩展、skills、prompts。

```json
{
  "id": "req-17",
  "type": "extension.reload"
}
```

---

### 3.5 系统控制

#### `system.abort`
中断当前操作。

```json
{
  "id": "req-18",
  "type": "system.abort"
}
```

#### `system.getState`
获取完整会话状态。

```json
{
  "id": "req-19",
  "type": "system.getState"
}
```

#### `system.shutdown`
优雅关闭。

```json
{
  "id": "req-20",
  "type": "system.shutdown"
}
```

---

### 3.6 文件操作（由前端驱动，桥接层代理）

#### `fs.read`
读取文件内容。

```json
{
  "id": "req-21",
  "type": "fs.read",
  "payload": {
    "path": "./extensions/pa-mio/index.ts"
  }
}
```

#### `fs.list`
列出目录内容。

```json
{
  "id": "req-22",
  "type": "fs.list",
  "payload": {
    "path": "./extensions"
  }
}
```

---

## 4. 后端 → 前端 事件 (Event)

后端主动推送，**不需要**前端请求。所有事件都有 `type: "event"`。

### 4.1 消息流事件

#### `event.message.start`
消息开始生成。

```json
{
  "type": "event",
  "payload": {
    "eventType": "message.start",
    "message": {
      "role": "assistant",
      "id": "msg-uuid",
      "timestamp": 1717000000000
    }
  }
}
```

#### `event.message.delta`
**核心流式事件**。每收到一个 token 推送一次。

```json
{
  "type": "event",
  "payload": {
    "eventType": "message.delta",
    "messageId": "msg-uuid",
    "delta": {
      "type": "text_delta",
      "content": "好"
    }
  }
}
```

delta 类型：

| `delta.type` | 说明 | 示例 `content` |
|-------------|------|---------------|
| `text_delta` | 文本 token | `"好"` |
| `thinking_delta` | 思考过程 token | `"让我先"` |
| `tool_call_delta` | 工具调用参数增量 | `{"name": "bash", "arguments": "{\"co"}` |

#### `event.message.end`
消息生成完毕。

```json
{
  "type": "event",
  "payload": {
    "eventType": "message.end",
    "messageId": "msg-uuid",
    "message": {
      "role": "assistant",
      "content": "好的，让我先看看...",
      "stopReason": "end_turn"
    }
  }
}
```

---

### 4.2 工具执行事件

#### `event.tool.start`
工具开始执行。

```json
{
  "type": "event",
  "payload": {
    "eventType": "tool.start",
    "toolCallId": "call-001",
    "toolName": "bash",
    "arguments": { "command": "ls -la" }
  }
}
```

#### `event.tool.output`
工具输出增量（流式）。

```json
{
  "type": "event",
  "payload": {
    "eventType": "tool.output",
    "toolCallId": "call-001",
    "chunk": "total 32\ndrwxr-xr-x"
  }
}
```

#### `event.tool.end`
工具执行完毕。

```json
{
  "type": "event",
  "payload": {
    "eventType": "tool.end",
    "toolCallId": "call-001",
    "result": {
      "output": "total 32\n...",
      "exitCode": 0,
      "truncated": false
    },
    "isError": false
  }
}
```

---

### 4.3 状态事件

#### `event.state.full`
完整状态同步（初始化或重大变更时推送）。

```json
{
  "type": "event",
  "payload": {
    "eventType": "state.full",
    "state": {
      "sessionId": "sess-uuid",
      "sessionName": "当前会话",
      "model": {
        "provider": "anthropic",
        "id": "claude-sonnet-4",
        "name": "Claude 4 Sonnet"
      },
      "thinkingLevel": "medium",
      "isStreaming": true,
      "isCompacting": false,
      "messages": [...],
      "activeTools": ["read", "bash", "edit"],
      "allTools": [...],
      "contextUsage": {
        "tokens": 12400,
        "contextWindow": 200000,
        "percent": 6.2
      },
      "steeringMessages": [],
      "followUpMessages": [],
      "sessionFile": "/path/to/session.jsonl"
    }
  }
}
```

#### `event.state.patch`
状态增量更新（频繁推送，只包含变更字段）。

```json
{
  "type": "event",
  "payload": {
    "eventType": "state.patch",
    "patch": {
      "isStreaming": false,
      "contextUsage": { "tokens": 13500, "percent": 6.75 }
    }
  }
}
```

---

### 4.4 会话生命周期事件

#### `event.session.created`
新会话创建成功。

```json
{
  "type": "event",
  "payload": {
    "eventType": "session.created",
    "session": { "id": "sess-new", "name": "新会话" }
  }
}
```

#### `event.session.switched`
会话切换成功。

```json
{
  "type": "event",
  "payload": {
    "eventType": "session.switched",
    "session": { "id": "sess-xxx", "name": "目标会话" }
  }
}
```

#### `event.session.compaction.start`
上下文压缩开始。

```json
{
  "type": "event",
  "payload": {
    "eventType": "session.compaction.start",
    "reason": "threshold"
  }
}
```

#### `event.session.compaction.end`
上下文压缩结束。

```json
{
  "type": "event",
  "payload": {
    "eventType": "session.compaction.end",
    "result": { "summary": "...", "compressedMessages": 10 },
    "aborted": false
  }
}
```

---

### 4.5 模型事件

#### `event.model.changed`
模型切换。

```json
{
  "type": "event",
  "payload": {
    "eventType": "model.changed",
    "model": {
      "provider": "openai",
      "id": "gpt-4.1",
      "name": "GPT-4.1"
    }
  }
}
```

#### `event.thinking.changed`
思考级别变更。

```json
{
  "type": "event",
  "payload": {
    "eventType": "thinking.changed",
    "level": "high"
  }
}
```

---

### 4.6 队列事件

#### `event.queue.updated`
steer / followUp 队列变更。

```json
{
  "type": "event",
  "payload": {
    "eventType": "queue.updated",
    "steering": ["先别管这个"],
    "followUp": ["再看看配置文件"]
  }
}
```

---

### 4.7 重试事件

#### `event.retry.start`
自动重试开始。

```json
{
  "type": "event",
  "payload": {
    "eventType": "retry.start",
    "attempt": 1,
    "maxAttempts": 3,
    "delayMs": 2000,
    "errorMessage": "Rate limit exceeded"
  }
}
```

#### `event.retry.end`
自动重试结束。

```json
{
  "type": "event",
  "payload": {
    "eventType": "retry.end",
    "success": true,
    "attempt": 1
  }
}
```

---

### 4.8 扩展事件

#### `event.extension.output`
扩展自定义输出（如 pa-usage 的实时统计）。

```json
{
  "type": "event",
  "payload": {
    "eventType": "extension.output",
    "extension": "pa-usage",
    "data": {
      "dailyTokens": 12400,
      "dailyCost": 0.35,
      "monthlyTokens": 345000,
      "monthlyCost": 8.2
    }
  }
}
```

---

## 5. 响应格式 (Response)

所有 Request 都会收到 Response，结构：

```json
{
  "id": "req-1",
  "type": "response",
  "payload": {
    "success": true,
    "data": { ... }
  }
}
```

或错误：

```json
{
  "id": "req-1",
  "type": "response",
  "payload": {
    "success": false,
    "error": "No model selected"
  }
}
```

---

## 6. 状态同步策略

前端不应自己维护完整状态副本，应采用 **"服务端主导 + 乐观更新"**：

1. **初始化**：连接成功后，后端主动推送一次 `event.state.full`
2. **流式更新**：LLM 输出期间，`event.message.delta` 高频推送（50-100ms/条）
3. **状态补正**：关键操作（切换模型、切换会话）后，后端推送 `event.state.patch`
4. **心跳**：后端每 30s 推送 `event.ping`，前端可据此检测连接健康

---

## 7. 前端状态机建议

```typescript
type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
type StreamingState = 'idle' | 'streaming' | 'tool_executing' | 'compacting';

interface FrontendState {
  connection: ConnectionState;
  streaming: StreamingState;
  session: SessionState | null;
  messages: Message[];
  queue: { steering: string[]; followUp: string[] };
  extensions: ExtensionOutput[];
}
```

---

## 8. 示例：完整对话流程

```
前端                              后端
  │                                 │
  ├─ chat.send ──────────────────→ │
  │                                 │ session.prompt(text)
  │ ←──────────── response ────────┤ { success: true }
  │                                 │
  │ ←──────── event.message.start ─┤
  │ ←──────── event.message.delta ─┤ "好"
  │ ←──────── event.message.delta ─┤ "的"
  │ ←──────── event.message.delta ─┤ "，"
  │ ←──────── event.tool.start ────┤ bash "ls -la"
  │ ←──────── event.tool.output ───┤ "total 32"
  │ ←──────── event.tool.end ──────┤ { exitCode: 0 }
  │ ←──────── event.message.delta ─┤ "项目"
  │ ←──────── event.message.delta ─┤ "结构"
  │ ←──────── event.message.end ───┤
  │                                 │
```

---

## 9. 待确认事项

- [ ] 是否支持多客户端同时连接？（广播/单播策略）
- [ ] 图片传输用 base64 还是 URL？
- [ ] 是否需要消息历史分页加载？（首次加载多少条）
- [ ] 扩展输出（pa-usage 等）的推送频率？（实时/轮询）
- [ ] 文件预览：前端直接读文件，还是走后端代理？
