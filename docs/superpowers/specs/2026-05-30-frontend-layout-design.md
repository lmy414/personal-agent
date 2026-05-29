# 澪号 Personal Agent — 前端架构设计

> 2026-05-30 | UI 布局 · WebSocket 协议 · 目录结构 · 扩展机制

## 视觉结构

```
┌──────────────────────────────────────────────────┐
│                 场景层 (z=0)                       │
│     房间背景 + 角色立绘（可替换素材）                │
│                                                  │
│  ┌─左列(400px)──┐  ┌─对话区(1fr)──────────────┐  │
│  │ 会话面板       │  │ 澪号 · 正在输入...  低电量 │  │
│  │ ├ 主会话+时间  │  │ ┌──────────┐ ┌────┐     │  │
│  │ ├ 搜索        │  │ │ 用户消息   │ │     │     │  │
│  │ └ 子会话列表   │  │ └──────────┘ │     │     │  │
│  ├──────────────┤  │      ┌────────┐│     │     │  │
│  │ 工具面板(flex) │  │      │ AI回复  ││     │     │  │
│  │ ├ grep  38ms  │  │      └────────┘│     │     │  │
│  │ ├ read  142ms │  │                │     │     │  │
│  │ ├ bash  1.2s  │  │  [输入框]    ↑ │     │     │  │
│  │ └ write  ...  │  └────────────────┘     │     │  │
│  ├──────────────┤                        │     │  │
│  │ 状态栏        │                        │     │  │
│  │ 时钟|token|¥  │                        │     │  │
│  │ 上下文|模型   │                        │     │  │
│  │ ████░░░ 19%  │                        │     │  │
│  └──────────────┘                        │     │  │
│                                          │     │  │
│            ┌──右侧展开面板(可拖拽·0~640px)──┘     │  │
│            │ [文件] [预览] [记忆]          ×      │  │
│            │                                    │  │
│            │ 标签内容（可切换）                    │  │
│            └────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## 设计原则

- **全部悬浮**：所有面板不贴边，Grid 管理间距（margin: 12px, gap: 10px）
- **玻璃拟态**：`backdrop-filter: blur(16px)` + 半透明背景 + 微边框
- **CSS Grid 自适应**：`grid-template-columns: 400px 1fr var(--right-panel-w)`
- **3 行**：`auto`(会话) `1fr`(工具填充) `auto`(状态栏)

## 面板详情

### 会话面板（左上）
- 主会话标签：头像 + 标题 + 最后活跃时间 + 轮次 + 展开箭头
- 展开后：搜索框 + 子会话列表（最多显示 3 个，可滚动）
- 子会话：当前话题分支，点选切换

### 工具面板（左中，弹性高度）
- 表头：状态指示灯 + "工具执行" + 记录数
- 条目：图标 + 工具名 + 详情摘要 + 耗时/状态
- 点击展开：完整输出（stdout/stderr/文件内容），代码用等宽字体
- 运行中条目有脉冲动画

### 状态栏（左下底）
- 第 1 行：⏱ 时钟（HH:MM:SS）+ 模型下拉选择
- 第 2 行：本次消耗 token + 折算费用（¥）
- 第 3 行：上下文窗口用量（current/max）+ 对话轮次
- 进度条：<60% 蓝色 → 60-80% 黄色 → >80% 红色

### 对话区（中央主区域）
- 表头：角色名 + 输入状态 + 电量指示（右侧）
- 消息列表：用户气泡（右对齐，紫色调）+ AI 气泡（左对齐，灰色调）
- 气泡圆角：对方方向为直角，模拟聊天软件
- 输入区：自适应高度 textarea + 发送按钮

### 右侧展开面板（可拖拽）
- 收起状态：右边缘竖排 "展开面板" 标签，点击展开至 320px
- 展开状态：左边缘蓝色拖拽把手，自由拖拽 0~640px
- 拖至 <120px 自动收起
- 标签栏：文件 | 预览 | 记忆
  - **文件**：目录树，`.md`/`.html` 高亮
  - **预览**：预览/源码切换按钮 + 渲染区（Markdown + 代码高亮）
  - **记忆**：关键词检索的记忆条目列表

## 组件树 → SolidJS

```
App
├── SceneLayer              // 底层场景+立绘，可替换素材
├── Overlay (Grid)          // CSS Grid 容器
│   ├── SessionPanel        // slot: left-top
│   │   ├── SessionHeader   //   头像 + 标题 + 时间 + 展开
│   │   └── SubSessionList  //   搜索 + 子会话列表
│   ├── ToolPanel           // slot: left-middle (flex: 1)
│   │   └── ToolEntry[]     //   每个条目可展开
│   ├── StatusBar           // slot: left-bottom
│   │   ├── Clock           //   实时时钟
│   │   ├── ModelSelect     //   模型下拉
│   │   ├── TokenUsage      //   token + 费用
│   │   └── ContextBar      //   上下文进度条
│   ├── ChatPanel           // slot: center (1fr)
│   │   ├── ChatHeader      //   角色名 + 电量
│   │   ├── MessageList     //   消息列表
│   │   │   └── Bubble[]    //     用户/AI 气泡
│   │   └── ChatInput       //   输入框 + 发送
│   └── RightPanel          // slot: right (可拖拽)
│       ├── TabBar          //   标签切换
│       ├── TabFileTree     //   文件目录
│       ├── TabPreview      //   文档预览 + 源码切换
│       └── TabMemory       //   记忆检索
```

## 扩展机制

每个 UI 区域 = 一个 slot。扩展注册方式：

```ts
interface Extension {
  id: string
  slot: 'left-top' | 'left-middle' | 'left-bottom' | 'center' | 'right'
  component: Component
  label?: string       // 标签栏显示名
  icon?: string
}
```

Shell 只负责 Grid 布局 + WebSocket 连接 + 全局状态分发。所有业务逻辑在扩展内。

## 技术栈

| 层 | 选型 |
|----|------|
| UI 框架 | SolidJS |
| 样式 | Tailwind CSS（底层），玻璃拟态用自定义 CSS |
| 状态管理 | Solid `createStore` + `createContext` |
| Markdown | marked |
| 代码高亮 | highlight.js |
| 通信 | WebSocket + JSON 协议 |
| 后端 | Node.js 桥接进程 → Pi SDK → DeepSeek API |

---

## WebSocket 协议

### 消息信封

```json
{ "type": "xxx.yyy", "id": "msg-uuid", "sessionId": "sess-xxx", "ts": 1717070400000, "payload": {} }
```

### 客户端 → 服务端

```
session.create    { model?, thinkingLevel? }
session.list      {}
session.switch    { sessionId }
session.delete    { sessionId }
message.send      { content }
message.cancel    {}
model.switch      { modelId }
model.list        {}
file.list         { path? }
file.read         { path }
memory.search     { query }
memory.list       { limit?, offset? }
```

### 服务端 → 客户端

```
会话层
session.created    { sessionId, model, thinkingLevel, createdAt }
session.list       { sessions: [{ id, title, lastActive, roundCount }] }
session.state      { model, thinkingLevel, contextUsed, roundCount }

对话层
turn.start         { turnIndex }
message.start      { messageId, role }
message.delta      { messageId, delta }           ← 流式增量
message.end        { messageId, content, usage }  ← 含 token 用量
turn.end           { turnIndex, usage, cost }

工具层
tool.start         { toolCallId, toolName, input }
tool.progress      { toolCallId, output }
tool.end           { toolCallId, toolName, output, duration, status }

状态推送（每次 turn 结束后）
status.update      { tokens, cost, contextUsed, contextMax, roundCount }

文件 & 记忆
file.list          { path, entries: [{ name, type, size }] }
file.content       { path, content, language? }
memory.results     { query, entries: [{ content, category, importance }] }
memory.list        { entries: [...], total }

系统
compaction         { beforeTokens, afterTokens }
error              { code, message, recoverable }
```

### 一次对话时序

```
Client                          Server
  ├─ message.send ───────────────→
  │                               ├─ turn.start
  │  ←─ turn.start ───────────────┤
  │  ←─ message.start ────────────┤
  │  ←─ message.delta × N ────────┤  (打字机效果)
  │                               ├─ tool.start (AI 中途调工具)
  │  ←─ tool.start ───────────────┤
  │  ←─ tool.end ─────────────────┤
  │  ←─ message.delta × N ────────┤
  │  ←─ message.end ──────────────┤
  │  ←─ turn.end ─────────────────┤
  │  ←─ status.update ────────────┤  (更新 token/费用)
```

### 桥接服务器核心逻辑

```
Pi 事件 → JSON → ws.send
ws.onmessage → JSON → Pi SDK 方法调用
```

```js
// 伪代码：50 行
const { session } = await createAgentSession({ ... });
const wss = new WebSocketServer({ port: 9229 });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.type === 'message.send') session.sendMessage(msg.payload.content);
    if (msg.type === 'model.switch') session.setModel(msg.payload.modelId);
  });
  
  session.on('message_update', (e) => ws.send(JSON.stringify({ type: 'message.delta', payload: { delta: e.delta } })));
  session.on('message_end',    (e) => ws.send(JSON.stringify({ type: 'message.end', payload: { content: e.message.content } })));
  session.on('tool_execution_start', (e) => ws.send(JSON.stringify({ type: 'tool.start', payload: { toolName: e.toolName } })));
  session.on('tool_execution_end',   (e) => ws.send(JSON.stringify({ type: 'tool.end', payload: { toolName: e.toolName } })));
});
```

---

## 目录结构

```
personal-agent/
├── bridge/                    ← Node.js 桥接服务器
│   ├── index.ts               ←   入口：启动 WS + 加载 Pi
│   ├── protocol.ts            ←   全部消息类型定义（单一真相源）
│   ├── dispatcher.ts          ←   收到消息 → 查路由表 → 调 handler
│   └── handlers/              ←   按消息类型拆文件
│       ├── session.ts
│       ├── message.ts
│       ├── tool.ts
│       ├── model.ts
│       ├── file.ts
│       ├── memory.ts
│       └── index.ts           ←   路由表汇总
│
├── frontend/                  ← SolidJS 前端
│   ├── src/
│   │   ├── shell/             ←   壳（唯一不扩展的部分）
│   │   │   ├── App.tsx        ←     Grid 布局 + 插槽渲染
│   │   │   ├── SceneLayer.tsx
│   │   │   └── useAgent.ts   ←     WebSocket hook（所有扩展共用）
│   │   ├── registry.ts        ←   扩展注册表
│   │   └── extensions/        ←   每个扩展一个文件夹
│   │       ├── chat-renderer/
│   │       ├── chat-input/
│   │       ├── session-panel/
│   │       ├── tool-panel/
│   │       ├── status-bar/
│   │       ├── file-tree/
│   │       ├── doc-preview/
│   │       ├── memory-view/
│   │       └── char-badge/
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── extensions/                ← Pi 后端扩展（已有）
│   ├── pa-mio/
│   ├── pa-sqlite/
│   └── ...
│
└── vendor/pi/                 ← Pi 框架（已有）
```

---

## 扩展机制

### 前端扩展注册

```ts
interface Extension {
  id: string
  slot: 'left-top' | 'left-middle' | 'left-bottom' | 'center' | 'right'
  component: Component
  label?: string
  icon?: string
}
```

### 三处约束

1. **单一真相源** — `protocol.ts` 是前后端消息格式唯一定义，两端共享
2. **Shell 不 import 扩展** — Shell 只查 `registry.getAll()` 按 slot 渲染，删扩展不影响 Shell
3. **状态不跨扩展** — 每个扩展自己的 store，通过 `useAgent()` 读全局数据，不写其他扩展状态

### 加新功能改动量

```
protocol.ts         +2 行（消息类型）
handlers/xxx.ts     新文件 ~15 行（服务端处理）
handlers/index.ts   +1 行（注册路由）
extensions/xxx/     新文件夹（前端组件）
```
现有代码零改动。

---

## 原型文件

`frontend-sketch/layout-mockup-v2.html` — 纯 HTML/CSS 交互原型，可浏览器直接打开。
