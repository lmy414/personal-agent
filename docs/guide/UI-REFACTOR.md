# wgnr-pi UI 重构指南

> 基于 `UI-ARCHITECTURE.md` 的拆解，提供重构分层架构和迁移路线图。

## 1. 重构分层架构建议

```
┌─────────────────────────────────────────┐
│  View Layer (Components)               │
│  App | Header | Sidebar | ChatArea      │
│  MessageList | InputBox | CmdPalette    │
│  ModalPortal | DebugPanel | HealthBar   │
├─────────────────────────────────────────┤
│  State Layer (Store)                   │
│  wsStore      — WebSocket 生命周期      │
│  sessionStore — 会话 CRUD + 侧边栏      │
│  chatStore    — 消息历史 + 流式渲染      │
│  modelStore   — 模型列表 + 思考级别      │
│  cmdStore     — 斜杠命令 + 自动补全      │
│  traceStore   — 流水线数据 + 轮询        │
│  uiStore      — 侧边栏/弹窗/主题/快捷键  │
├─────────────────────────────────────────┤
│  Service Layer                         │
│  wsService    — WebSocket 封装 + 重连   │
│  restService  — REST API 封装           │
│  mdService    — marked + DOMPurify      │
│  storageService — localStorage 抽象     │
├─────────────────────────────────────────┤
│  Domain Types                          │
│  IMessage, ISession, IModel, ITrace... │
└─────────────────────────────────────────┘
```

## 2. 关键模块重构要点

### 2.1 消息流式渲染
- **当前**：`currentAssistantEl` 全局 DOM 引用，直接 `innerHTML = md(text)`
- **重构**：消息数组 `messages[]`，流式时更新最后一条 `assistant` 消息的 `content`，由框架 diff 渲染

### 2.2 WebSocket 消息路由
- **当前**：`handleEvent` 一个 250+ 行的 switch
- **重构**：注册式消息处理器
  ```ts
  wsService.on('message_update', chatStore.handleMessageUpdate);
  wsService.on('session_state', sessionStore.handleSessionState);
  ```

### 2.3 会话列表侧边栏
- **当前**：`renderSessionList` 直接拼 HTML 字符串 + 内联事件绑定
- **重构**：响应式 `sessions[]` + `activeSessionId`，框架列表渲染

### 2.4 流水线面板
- **当前**：`renderTrace` 完全字符串拼接（~180 行），使用 `var` 和 DOM API
- **重构**：`TraceStep` 组件，按 `detail.type` 分发子组件（PromptView / ApiView / CounterView / ToolView）

### 2.5 模型选择弹窗
- **当前**：字符串拼接 + `dataset.id/provider` + 闭包事件
- **重构**：`ModelPicker` 组件，内部维护 `searchQuery` 和 `filteredModels`

## 3. 可独立拆分的模块

| 模块 | 职责 | 建议接口 |
|------|------|----------|
| **MarkdownRenderer** | marked + DOMPurify + 链接安全策略 | `renderMarkdown(raw: string): SafeHTML` |
| **ImageUploader** | 粘贴/选择/预览/删除 | `pendingImages: ImageFile[]`, `add(file)`, `remove(index)` |
| **CmdPalette** | 命令过滤、键盘导航、选中填充 | `open(query)`, `select(cmd)`, `commands: Command[]` |
| **SessionManager** | API 调用 + localStorage 缓存合并 | `load()`, `archive(file)`, `delete(file)`, `restore(file)` |
| **TraceRenderer** | 流水线面板数据转 DOM | `render(steps: TraceStep[]): VNode/HTML` |
| **AutoResizeTextarea** | 输入框高度自适应 | `bind(textarea)` |

## 4. 迁移优先级

| 优先级 | 模块 | 原因 |
|--------|------|------|
| P0 | **消息渲染区** | 最频繁更新，DOM 操作最多，性能瓶颈 |
| P0 | **WebSocket 封装** | 核心数据入口，需先建立稳定数据层 |
| P1 | **输入区 + CmdPalette** | 交互复杂（自动补全、图片预览、自适应高度） |
| P1 | **Session 侧边栏** | 字符串拼接 + 内联事件绑定，易内存泄漏 |
| P2 | **Model Picker / Modals** | 相对独立，逻辑简单 |
| P2 | **Debug 流水线面板** | 非主路径，但 `renderTrace` 字符串拼接量最大 |
| P3 | **CSS 变量与主题** | 可保留 `:root` 体系，最后迁移到 CSS-in-JS |

## 5. 如不使用框架的最小拆分

若不想引入 React/Vue，至少拆分为：

```
index.html    — 纯模板
styles.css    — 全部样式
app.js        — 入口 + 事件绑定
ws.js         — WebSocket 连接与消息路由
session.js    — 会话管理 API
render.js     — Markdown / 消息 / 流水线渲染
state.js      — 全局状态对象（取代散落的 let 变量）
```

---

**关联文档**：
- UI 层级拆解 → `UI-ARCHITECTURE.md`
- HTML 文件索引 → `HTML-DOCS.md`
- 流水线透视设计 → `../design/03-observe.md`
