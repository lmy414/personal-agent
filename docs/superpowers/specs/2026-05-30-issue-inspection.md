# 澪号 Personal Agent — 问题检查文档

> 2026-05-30 | P0-P3 分级 · 文件定位 · 根因分析 · 修复方向

## 审查范围

- **类型文件：** 30+ 文件（bridge 8 + frontend 22 + 配置/CSS）
- **对照基线：** 4 份 design spec + `layout-mockup-v2.html` + CLAUDE.md 硬约束
- **方法：** 逐文件代码走查 → spec 逐条对照 → WebSocket 数据流追踪 → 用户反馈交叉验证

## 修复流程约束（来自 CLAUDE.md）

所有修复必须遵守，不因紧急度跳过：

| 约束 | 适用场景 | 说明 |
|------|---------|------|
| 原型先行 | UI 改动 | 先在 `frontend-sketch/layout-mockup-v2.html` 验证，再改组件 |
| 协议先行 | 协议改动 | 先改 `bridge/protocol.ts`，再同步 bridge handler + 前端 |
| 检查通过 | 任何修改 | `npm run check`（TypeScript strict + lint）必须通过 |
| 更新 spec | 涉及 spec | 修复后更新对应 spec 文档 |
| 不碰 vendor | 全局 | 不修改 `vendor/pi/` 下任何文件 |
| 扩展隔离 | 扩展修改 | 扩展之间不互相 import |

---

## 问题统计

| 级别 | 含义 | 数量 |
|------|------|------|
| 🔴 P0 | 功能完全不可用或数据错误 | 5 |
| 🟠 P1 | 功能可用但有明显缺陷 | 12 |
| 🟡 P2 | 体验 / 健壮性 / 边界情况 | 7 |
| ⚪ P3 | 规范偏离 / 技术债务 / 未实现项 | 10 |
| **合计** | | **34** |

---

## 🔴 P0 · 阻断级

### P0-01: 文件树首次加载永久卡死

**现象：** 页面加载后首次打开右侧面板「文件」标签，始终显示"加载中..."。必须切换到「预览」再切回才能显示文件列表。

**复现条件：** 每次页面刷新后首次点击文件标签

**根因：** WebSocket 竞态条件。`FileTree.tsx:76` 在 `onMount` 中调用 `agent.send('file.list', { path: '.' })`，但此时 `useAgent.tsx` 的 WebSocket `connect()` 可能尚未完成握手。`send()` 函数在 `useAgent.tsx:380-381` 对 WS 未就绪状态静默丢弃：

```ts
// useAgent.tsx:380-381
const send = (type: string, payload: unknown) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return  // ← 静默丢失
```

请求被丢弃后，`file.list` 响应永远不会到达，`loading` 信号永远为 `true`。切换标签 → `Switch`/`Match` 卸载 FileTree → 切回时重新挂载 → WS 已就绪 → 请求成功。

**修复方向：** useAgent 增加待发送队列，WS `onopen` 后自动批量发送积压请求。原型无需改动。

**影响范围：** 所有依赖 WS 订阅 + 首次即发请求的组件（FileTree, DocPreview, MemoryView）

---

### P0-02: 对话区双重输入框

**现象：** 聊天区域底部出现两个输入框。

**根因：** 两个扩展注册到同一个 `center` slot，且 ChatRenderer 已内置输入区：

- [chat-renderer/index.ts:4-8](frontend/src/extensions/chat-renderer/index.ts#L4-L8) — `slot: 'center'`，ChatRenderer 内含完整输入区（附件 + 拖放 + 发送）
- [chat-input/index.ts:4-8](frontend/src/extensions/chat-input/index.ts#L4-L8) — `slot: 'center'`，ChatInput 是纯文本输入（无附件、无拖放）

App.tsx 对 center slot 做 `<For>` 遍历渲染，两个组件都挂载到同一容器。ChatRenderer `style="flex:1"` 撑满空间，ChatInput 被挤出视口或叠在下方。

**修复方向：** 
1. 删除 `chat-input` 扩展注册（ChatRenderer 已含完整输入功能）
2. 或让 ChatInput 作为 ChatRenderer 的子组件，通过扩展间事件通信（但如果选此方案需改扩展隔离规则）
3. **推荐方案 1** — ChatInput 功能是 ChatRenderer 的真子集，直接删除注册

**原型改动：** 在 `layout-mockup-v2.html` 中明确输入区归属

---

### P0-03: MemoryView 与后端完全断开

**现象：** 记忆面板显示硬编码的 4 条 demo 数据，搜索功能不返回结果。

**根因：** 前后端双重断裂：

1. **前端** [MemoryView.tsx:7-12](frontend/src/extensions/memory-view/MemoryView.tsx#L7-L12) — `memories` 用 `createSignal` 初始化为写死的 4 条数据
2. **前端** `handleSearch()` 调 `send('memory.search', ...)` 但从不订阅 `memory.results` 响应，桥接返回的结果无人接收
3. **后端** [memory.ts:4-8](bridge/handlers/memory.ts#L4-L8) — `memories` 数组硬编码在内存中，无持久化，重启丢失

**修复方向：**
- 前端 `onMount` 时发 `memory.list` + 订阅 `memory.results` 和 `memory.list`
- 后端迁移到 SQLite `memories` 表（或复用 `messages` 表的记忆提取）
- 原型无需改动

---

### P0-04: 右侧面板关闭按钮无效

**现象：** 点击右侧面板 × 按钮无反应。

**根因：** [RightPanelTabs.tsx:38-41](frontend/src/extensions/right-panel/RightPanelTabs.tsx#L38-L41) 派发自定义事件：

```tsx
window.dispatchEvent(new CustomEvent('close-right-panel'))
```

但 [App.tsx](frontend/src/shell/App.tsx) 中没有任何地方监听 `close-right-panel` 事件。唯一的关闭方式是双击拖拽把手 → `setRightPanelW(0)`。

**修复方向：** App.tsx 在 `onMount` 中监听 `close-right-panel`，收到后调 `setPanelVisible(false)` + `setRightPanelW(0)`

---

### P0-05: 拖拽把手不工作 / 拖到一半卡死

**现象：** 拖拽右侧面板左边缘时，面板宽度不跟随鼠标，或拖到半路卡死。

**根因：** [App.tsx:16-17](frontend/src/shell/App.tsx#L16-L17) 计算逻辑：

```tsx
const w = startW - (ev.clientX - startX)  // 向左拖减小宽度
```

但 CSS `.panel-drag-handle` 的 `left: -5px` 意味着把手在面板左侧外部，鼠标实际位置与 `getBoundingClientRect` 的计算基准不一致。此外 `handleDragStart` 未设置 `dragging` class（CSS 中 `.panel-drag-handle.dragging::after` 定义了但 JS 没加）。

**修复方向：** 原型文件中验证拖拽行为，统一拖拽计算基准点。拖动时 body 加 `user-select: none` + `cursor: col-resize`。

---

## 🟠 P1 · 功能缺陷

### P1-01: 会话刷新后引用文件内容全部展开

**现象：** 用户在对话中拖入文件作为附件 → 发送 → 切换到其他会话 → 切回来，文件内容以 Markdown 代码块形式全部展开在消息气泡中。

**根因：** [ChatRenderer.tsx:68-73](frontend/src/extensions/chat-renderer/ChatRenderer.tsx#L68-L73) 发送时把文件完整内容嵌入消息文本：

```tsx
// ChatRenderer.tsx:68-73
const fileBlocks = atts.map((a) => {
    const ext = a.name.split('.').pop() ?? ''
    if (isImg) return `![${a.name}](${a.path})`
    return `\`\`\`${ext} ${a.name}\n${a.content}\n\`\`\``  // ← 嵌入完整内容
}).join('\n\n')
```

然后这个消息（含完整文件内容）通过 `message.send` 持久化到 SQLite（[message.ts:116-118](bridge/handlers/message.ts#L116-L118)）。会话切换 → `loadHistory` → 消息渲染 → `marked.parse()` 把代码块原样呈现。

**修复方向：**
- 消息协议区分「给 AI 的 context」（含完整内容）和「UI 显示文本」（仅文件名+简要标注）
- AI 发送时仍把内容注入 context，但 `displayContent` 和 `attachments` meta 分开存储
- 历史加载时，有 `attachments` 的消息渲染为附件徽章而非展开内容
- 消息可以不包含完整内容，让 AI 通过文件路径引用即可

**原型改动：** 设计附件消息的 UI 呈现方式

---

### P1-02: 文件树切换标签后重新加载

**现象：** 文件 → 预览 → 文件，文件树状态丢失（展开的目录、滚动位置）。

**根因：** [RightPanelTabs.tsx:44-54](frontend/src/extensions/right-panel/RightPanelTabs.tsx#L44-L54) 使用 `<Switch>/<Match>`：

```tsx
<Switch>
  <Match when={activeTab() === 'files'}><FileTree /></Match>
  <Match when={activeTab() === 'preview'}><DocPreview /></Match>
  <Match when={activeTab() === 'memory'}><MemoryView /></Match>
</Switch>
```

SolidJS 的 `<Switch>` 在条件不匹配时销毁子组件 DOM，切回来时重新创建 → `onMount` 再次触发 → 重新发 `file.list` → 整棵树重建，展开状态丢失。

**修复方向：** 改用 CSS `display: none/block` 保持 DOM 存活（或用 `<Show>` + `fallback` 但保留组件实例）。代价：三个面板同时挂载，内存略增。

---

### P1-03: 模型下拉列表硬编码

**现象：** StatusBar 模型下拉固定显示 DeepSeek V3 / R1 / V4 Pro，与实际可用模型不一致。

**根因：** 双重硬编码：

1. **后端** [pi-session.ts:27-32](bridge/pi-session.ts#L27-L32) — `MODEL_MAP` 仍作为主逻辑，`deepseek-r1` 映射到 `deepseek-v4-flash`
2. **后端** [pi-session.ts:47-49](bridge/pi-session.ts#L47-L49) — `getAvailableModels()` 无 registry 时回退到 `Object.keys(MODEL_MAP)`
3. **前端** [StatusBar.tsx:48-51](frontend/src/extensions/status-bar/StatusBar.tsx#L48-L51) — `<option>` 硬编码三个模型名

Dashboard spec 已明确要求：`model.list` → Pi `modelRegistry.getAll()` → `status.update.availableModels` → StatusBar 动态渲染。但整条链路未接通。

**修复方向（协议先行）：**
1. `protocol.ts` — `StatusPayload` 新增 `availableModels` 字段
2. `model.ts` — `handleModelList` 从 session.modelRegistry 取真实列表（修复 `as any`）
3. `pi-session.ts` — 删除 `MODEL_MAP` 主路径，保留为注释 fallback
4. `useAgent.tsx` — WS `onopen` 后发 `model.list`，`status` store 接收 `availableModels`
5. `StatusBar.tsx` — `<For>` 动态渲染 option
6. 更新 Dashboard spec 标记为已实现

---

### P1-04: 模型切换返回假数据

**现象：** 切换模型后，上下文用量和轮次被重置为 0。

**根因：** [model.ts:26-32](bridge/handlers/model.ts#L26-L32) `handleModelSwitch` 发送硬编码值：

```ts
ws.send(JSON.stringify({
    type: 'session.state',
    payload: { model: payload.modelId, thinkingLevel: 'medium', contextUsed: 0, roundCount: 0 },
}))
```

应该从 Pi session 获取真实值：当前模型名、contextUsage、roundCount。

另外未检查 `session.isStreaming`——对话中切换模型应返回 `BUSY` 错误。

**修复方向：** handler 改为读取 `session.model.id`、`session.getContextUsage()`、`getSessionMeta().roundCount`。新增 `isStreaming` 检查。

---

### P1-05: 上下文最大值仍硬编码 128000

**现象：** 上下文进度条显示 `xxx / 128k`，但不反映实际模型的 contextWindow。

**根因：** 两处硬编码未清理：

1. [message.ts:354](bridge/handlers/message.ts#L354) — `contextMax: ctx?.contextWindow ?? 128000`（有 Pi 值时用 Pi，否则 fallback 128k——但 `??` 在 `0` 值时不会触发 fallback，所以如果 Pi 返回了 contextWindow 就 OK）
2. [useAgent.tsx:71](frontend/src/shell/useAgent.tsx#L71) — 初始值 `contextMax: 128000`，在桥接 `status.update` 到达前显示错误值

实际上 Pi 的 `getContextUsage()` 可能返回 `undefined`（无 session file），此时仍用 128k fallback。但更好的做法是：从 `session.model.contextWindow` 获取模型真实值。

**修复方向：**
- `message.ts` 的 fallback 改为从 `session.model?.contextWindow` 获取
- `useAgent.tsx` 初始值改为 0（等桥接推送后自动设置）
- Dashboard spec 相关实现

---

### P1-06: 会话历史消息 partial 始终为 false

**现象：** 从数据库加载的历史消息不保留"未完成"状态。

**根因：** [session.ts:169](bridge/handlers/session.ts#L169) `handleSessionHistory` 组装消息时：

```ts
messages: messages.map((m) => ({
    messageId: m.message_id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    partial: false,  // ← 始终 false
    ...
}))
```

如果会话在上次退出时正处于流式输出中途，数据库里存的是部分内容。但重载时 `partial` 被写死为 `false`，前端不显示"未完成"状态。

**修复方向：** `messages` 表新增 `partial` 列，或根据 `message.end` 是否已写判断完整性。

---

### P1-07: session.switch 懒创建时不检查 isStreaming

**现象：** 如果在对话中途切换会话，旧会话的流式输出不会被中止。

**根因：** [session.ts:109-137](bridge/handlers/session.ts#L109-L137) `handleSessionSwitch` 只懒创建 Pi session，未检查当前会话是否正在流式输出。也没调用 `session.abort()`。

**修复方向：** 切换前检查旧 session 的 `isStreaming`，若为 true 则 `abort()` 后再切换。

---

### P1-08: DocPreview 订阅无 session 过滤

**现象：** 如果同时有两个 WebSocket 连接（多标签页），一个标签页点击文件，另一个的 DocPreview 也会收到内容。

**根因：** [DocPreview.tsx:32](frontend/src/extensions/doc-preview/DocPreview.tsx#L32) 订阅 `file.content` 时无 sessionId 过滤——收到任何 session 的文件内容都会更新预览区。

**修复方向：** 订阅回调中比对 `msg.sessionId === agent.sessionId()`。

---

### P1-09: useAgent status 合并逻辑bug

**现象：** `session.state` 推送只更新 `contextUsed` 和 `roundCount`，但可能错误覆盖 `status` 的其他字段。

**根因：** [useAgent.tsx:279-281](frontend/src/shell/useAgent.tsx#L279-L281)：

```ts
case 'session.state': {
    const p = msg.payload as { model: string; thinkingLevel: string; contextUsed: number; roundCount: number }
    setStatus({ ...status, contextUsed: p.contextUsed, roundCount: p.roundCount })
```

`{ ...status, ... }` 展开的 `status` 是调用时的快照值——如果此前 `status.update` 已更新了 `tokens`/`cost`，此处的展开可能用过期值覆盖。应改用 Solid Store 的 `setStatus('contextUsed', p.contextUsed)` 逐字段更新。

---

### P1-10: model.list 响应类型不安全

**现象：** `handleModelList` 使用了 `as any` 绕开类型检查。

**根因：** [model.ts:35-46](bridge/handlers/model.ts#L35-L46) — `StatusPayload` 没有 `availableModels` 字段，所以写 `as any`：

```ts
ws.send(JSON.stringify({
    type: 'status.update',
    payload: { availableModels: models },
} as any))
```

**修复方向：** 先在 `protocol.ts` 中给 `StatusPayload` 加 `availableModels?: { id: string; name: string; contextWindow: number }[]`，然后删除 `as any`。

---

### P1-11: memory.search / memory.list 无持久化

**现象：** 记忆搜索只返回 3 条写死的 demo 数据，开关服务后丢失。

**根因：** [memory.ts:4-8](bridge/handlers/memory.ts#L4-L8) 硬编码内存数组。前端 MemoryView 也同样硬编码。

**修复方向：**
- 后端创建 `memories` 表（或从 assistant 回复中提取关键信息自动存储）
- 前端 `onMount` 时请求 `memory.list` + 订阅响应
- 先做最小实现：SQLite 存储 + CRUD handler

---

### P1-12: FileTree 构造的 path 在 Windows 上有问题

**现象：** Windows 上文件路径拼接可能出现 `\` 和 `/` 混用。

**根因：** [FileTree.tsx:46](frontend/src/extensions/file-tree/FileTree.tsx#L46)：

```ts
path: payload.path ? `${payload.path}/${e.name}`.replace(/\/\//g, '/') : e.name,
```

`payload.path` 在 Windows 上可能是 `D:\project\src`，拼接后变成 `D:\project\src/文件名`（混用）。虽然后续 `replace` 只替换双斜杠，不解决正反斜杠混用。

**修复方向：** 统一用 `/` 作为路径分隔符（bridge `file.ts` 的 `resolveSafe` 也会 normalize），或前端用 `path` 模块规范化。

---

## 🟡 P2 · 体验 / 健壮性

### P2-01: 无 isStreaming 状态追踪

**现象：** 前端无法感知"AI 正在回复中"，无法禁用模型切换 / 压缩按钮 / 新消息发送。

**根因：** `useAgent.tsx` 没有 `isStreaming` signal。Dashboard spec 要求：`turn.start` → true，`turn.end` / `error` / `agent_end` → false。

**修复方向：** useAgent 新增 `isStreaming` signal，在 `turn.start` / `turn.end` / `error` 处理中切换。

**影响：** P1-04（模型切换检查）、StatusBar 模型禁用、ChatInput 发送禁用

---

### P2-02: WS 断连无用户提示

**现象：** WebSocket 断开后，前端只有状态栏小圆点从蓝变红。无 toast / 重新连接提示 / 重试次数。

**根因：** [useAgent.tsx:121-129](frontend/src/shell/useAgent.tsx#L121-L129) 连接管理：

```ts
ws.onclose = () => {
    setConnected(false)
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 3000)  // 固定 3s 重连
}
```

无指数退避、无重连提示、已发送但未响应的消息丢失。

**修复方向：**
- 指数退避重连（3s → 6s → 12s → 30s cap）
- 断连 >3s 时在聊天区插入系统消息"重连中..."
- 重连成功后清理系统消息

---

### P2-03: 消息列表空态

**现象：** 新会话无消息时，聊天区一片空白。

**根因：** [ChatRenderer.tsx:192](frontend/src/extensions/chat-renderer/ChatRenderer.tsx#L192) 的 `<For>` 在有 filter 后可能返回空数组，无 fallback。

**修复方向：** 空消息时显示引导文案："向澪发送消息开始对话"。

---

### P2-04: 工具面板详情可读性差

**现象：** 工具条目的 `input` 摘要显示 `JSON.stringify(input).slice(0, 60)`，大量截断在 JSON 中间，不可读。

**根因：** [ToolPanel.tsx:47](frontend/src/extensions/tool-panel/ToolPanel.tsx#L47)：

```tsx
<div class="tool-detail">{props.tool.input ? JSON.stringify(props.tool.input).slice(0, 60) : '...'}</div>
```

**修复方向：** 显示工具名 + 第一个有意义参数（如 `grep: "pattern"`），而非全部 JSON 截断。完整输入在展开后显示。

---

### P2-05: 关闭右面板时无状态保存

**现象：** 双击把手关闭右侧面板后，之前展开的文件树、预览内容全部丢失。

**根因：** 关闭是通过 `setRightPanelW(0)` 实现的——面板宽度变为 0，内部 DOM 被 CSS 隐藏但组件未销毁。但重新展开宽度后，状态因 P1-02 的 `Switch`/`Match` 问题可能已不一致。

**修复方向：** 与 P1-02 修复一起，确保面板隐藏（`display:none`）而非宽度=0 时 DOM 保持。

---

### P2-06: 附件拖放区域视觉反馈不完整

**现象：** 从文件树拖文件到聊天区时，拖放手柄区高亮不明显。

**根因：** [ChatRenderer.tsx:233](frontend/src/extensions/chat-renderer/ChatRenderer.tsx#L233) `drop-target` class 只改变输入框边框颜色（[App.css:685-688](frontend/src/shell/App.css#L685-L688)），但整个聊天区无高亮。

**修复方向：** 原型验证拖放视觉方案 → 聊天区整体加半透明边框脉冲动画。

---

### P2-07: 子会话列表空态无引导

**现象：** 无子会话时，折叠区展开后一片空白。

**根因：** [SessionPanel.tsx:199-205](frontend/src/extensions/session-panel/SessionPanel.tsx#L199-L205) 仅在搜索无结果时显示"无匹配会话"，但无子会话时无提示。

**修复方向：** 子会话为空时显示"暂无子会话，点击 + 创建"。

---

## ⚪ P3 · 规范偏离 / 技术债务

### P3-01: dashboard spec — session.compact 未实现

**Spec 依据：** `2026-05-30-dashboard-design.md` 第 66-92 行定义 `session.compact` handler

**现状：** 
- `dispatcher.ts` 路由表无 `session.compact`
- `session.ts` 无 `handleSessionCompact` 函数
- `protocol.ts` 有 `compaction`（server→client）但无 `session.compact`（client→server）和 `session.compacted`（server→client）
- 前端 StatusBar 无压缩按钮

**修复方向：** 协议先行 → handler → 前端按钮

---

### P3-02: dashboard spec — context_log 表未创建

**Spec 依据：** `2026-05-30-dashboard-design.md` 第 50-63 行

**现状：** [db.ts](bridge/db.ts) 的 `initDB()` 创建了 `conversations` / `messages` / `tool_calls` / `settings`，但无 `context_log` 表。`message.ts` 的 `agent_end` 也未写入 context_log。

**修复方向：** db.ts 加 `CREATE TABLE IF NOT EXISTS context_log`，message.ts 的 `status.update` 后插入记录。

---

### P3-03: dashboard spec — MODEL_MAP 残留

**Spec 依据：** `2026-05-30-dashboard-design.md` 第 133-136 行明确要求删除或降级 MODEL_MAP

**现状：** [pi-session.ts:27-32](bridge/pi-session.ts#L27-L32) MODEL_MAP 仍存在，且：
- `deepseek-r1` 错误映射到 `deepseek-v4-flash`
- `getAvailableModels()` 无 registry 时回退到 `Object.keys(MODEL_MAP)`

**修复方向：** MODEL_MAP 改为注释保留（文档用途），主逻辑从 registry 读取。

---

### P3-04: dashboard spec — isStreaming 未实现

**Spec 依据：** `2026-05-30-dashboard-design.md` 第 162-164 行

**现状：** `useAgent.tsx` 无 `isStreaming` signal。`StatusBar.tsx` 模型下拉未在 `isStreaming` 时禁用。

**修复方向：** 同 P2-01，在 useAgent 新增 signal，StatusBar 消费。

---

### P3-05: protocol.ts StatusPayload 缺少字段

**Spec 依据：** `2026-05-30-dashboard-design.md` 第 39 行定义 `status.update` 扩展 `availableModels` 字段

**现状：** [protocol.ts:80-86](bridge/protocol.ts#L80-L86) `StatusPayload` 只有 5 个字段：

```ts
export interface StatusPayload {
    tokens: number; cost: number;
    contextUsed: number; contextMax: number; roundCount: number;
}
```

缺失：`model?: string`、`availableModels?: ...[]`

**修复方向：** 协议先行，扩展 StatusPayload。

---

### P3-06: session management spec — 重命名 handler 无防注入

**Spec 依据：** `2026-05-30-session-management-design.md` 第 13 行定义 `session.rename`

**现状：** [session.ts:190-207](bridge/handlers/session.ts#L190-L207) 直接接收 title 写入 SQL，无长度限制和 XSS 过滤。

**修复方向：** title 限制 100 字符，Sanitize HTML 标签。

---

### P3-07: ChatRenderer + ChatInput 架构冗余

**现状：** 2 个扩展注册到同一 slot：
- `ChatRenderer` — 消息列表 + 输入区 + 附件 + 拖放
- `ChatInput` — 纯文本输入（ChatRenderer 的真子集）

`ChatInput` 缺少 `ChatRenderer` 的全部高级功能（附件徽章、拖放、文件引用）。两者同时渲染造成 P0-02。

**修复方向：** 方案已在 P0-02 给出。从架构角度，`ChatInput` 应删除或将功能合并入 `ChatRenderer`。

---

### P3-08: memory handler 架构不符合 spec

**Spec 依据：** `2026-05-30-frontend-layout-design.md` 第 210-212 行定义 `MemoryView` 为"关键词检索的记忆条目列表"

**现状：** 前后端均硬编码 demo 数据。`memory.search` 只做 `String.includes`，无倒排索引/向量搜索/sqlite FTS。

**修复方向：** 最小可用方案：SQLite `memories` 表 + LIKE 搜索。长期：FTS5 或向量嵌入。

---

### P3-09: 消息模型设计缺陷 — display vs context 混用

**现象：** 消息内容同时用于 AI context（发给 DeepSeek）和 UI display（气泡渲染），导致：
- 文件内容嵌入消息（P1-01）
- 展示文本和发送文本完全相同，无法做 UI 层面的简化显示

**根因：** `protocol.ts` 的 `message.send` payload 只有 `content` 字段（+ `attachments` meta）。`useAgent.tsx:392-405` 的 `sendMessage` 有 `displayContent` 参数但传给 handler 后又变成了同一个 `content`。

**修复方向：** 消息协议增设 `displayContent` 字段，持久化时两字段分开存。渲染时用 `displayContent`，AI context 用 `content`。

---

### P3-10: TypeScript 类型缺口

**现状：**
- [memory.ts](bridge/handlers/memory.ts) 返回的 `MemoryEntry` 使用 `category: 'preference'` 但 protocol 定义是 `category: string`
- [model.ts:45](bridge/handlers/model.ts#L45) 用 `as any` 绕开 `StatusPayload` 缺少字段
- [pi-session.ts](bridge/pi-session.ts) 多处 `any` 用于 Pi SDK 类型缺口（可接受）
- `useAgent.tsx:167` `(msg as any).sessionId` 访问——`ServerMessage` 联合类型没有公共 `sessionId` 字段

**修复方向：** `MessageEnvelope` 的 `sessionId` 应在 `ServerMessage` 联合类型中可索引。可以在 `MessageEnvelope` 上加一个 type guard 或让 `ServerMessage` 的所有成员都能取 `sessionId`。

---

## 汇总矩阵

### 问题 × 文件

| 文件 | P0 | P1 | P2 | P3 |
|------|----|----|----|-----|
| `useAgent.tsx` | P0-01 | P1-09 | P2-01, P2-02 | P3-04, P3-10 |
| `ChatRenderer.tsx` | — | P1-01 | P2-03, P2-06 | P3-07, P3-09 |
| `RightPanelTabs.tsx` | — | P1-02 | — | — |
| `FileTree.tsx` | P0-01 | P1-12 | — | — |
| `MemoryView.tsx` | P0-03 | — | — | — |
| `ChatInput` (整个) | P0-02 | — | — | P3-07 |
| `App.tsx` | P0-04, P0-05 | — | — | — |
| `StatusBar.tsx` | — | P1-03 | — | P3-04 |
| `DocPreview.tsx` | — | P1-08 | — | — |
| `SessionPanel.tsx` | — | — | P2-07 | — |
| `ToolPanel.tsx` | — | — | P2-04 | — |
| `message.ts` | — | P1-05 | — | P3-02 |
| `session.ts` | — | P1-06, P1-07 | — | P3-06 |
| `model.ts` | — | P1-04, P1-10 | — | — |
| `memory.ts` | P0-03 | P1-11 | — | P3-08 |
| `pi-session.ts` | — | P1-03 | — | P3-03 |
| `protocol.ts` | — | — | — | P3-01, P3-05 |
| `db.ts` | — | — | — | P3-02 |
| `dispatcher.ts` | — | — | — | P3-01 |
| `App.css` | — | — | P2-05 | — |

### 修复依赖关系

```
P3-05 (protocol StatusPayload) 
  ├→ P1-03 (模型下拉动态化)
  ├→ P1-10 (删除 as any)
  └→ P3-04 (isStreaming)

P2-01 (isStreaming signal)
  ├→ P1-04 (模型切换检查 isStreaming)
  ├→ P1-07 (会话切换检查 isStreaming)
  └→ P3-04 (StatusBar 禁用下拉)

P3-01 (protocol session.compact)
  └→ P3-01 前端压缩按钮

P0-01 (WS 发送队列)
  ├→ FileTree, DocPreview, MemoryView 首次加载
  └→ 所有 onMount 即发请求的组件

P3-09 (display vs context 分离)
  └→ P1-01 (文件内容不嵌入显示)
```

---

## 附录 A: Spec 对照清单

### 2026-05-30-frontend-layout-design.md

| 条目 | 状态 |
|------|------|
| Grid 布局 3 列 3 行 | ✅ 已实现 |
| 全部悬浮 + 玻璃拟态 | ✅ 已实现 |
| 会话面板（主会话 + 子列表） | ✅ 已实现（P2-07 空态缺失） |
| 工具面板（表头 + 条目 + 展开） | ✅ 已实现（P2-04 可读性差） |
| 状态栏（时钟 + token + 上下文） | ✅ 已实现（P1-03 模型硬编码） |
| 对话区（消息列表 + 气泡 + 输入） | ⚠️ 双重输入区（P0-02） |
| 右侧可拖拽面板 | ⚠️ 拖拽bug（P0-05）+ 关闭无效（P0-04） |
| 文件树 | ⚠️ 首次加载卡死（P0-01） |
| 文档预览（Markdown + 源码切换） | ✅ 已实现 |
| 记忆检索 | ❌ 断开（P0-03） |
| 扩展机制 | ✅ 已实现 |
| WebSocket 协议 | ⚠️ 部分消息缺失（P3-01, P3-05） |

### 2026-05-30-session-management-design.md

| 条目 | 状态 |
|------|------|
| 主会话「澪」不可删除 | ✅ 已实现 |
| 子会话 CRUD | ✅ 已实现 |
| 历史消息持久化 | ✅ 已实现 |
| AI 自动命名 | ✅ 已实现 |
| 工具调用持久化 | ✅ 已实现 |
| 会话切换 | ⚠️ 未检查 isStreaming（P1-07） |
| session.history | ⚠️ partial 始终 false（P1-06） |
| 附件元数据持久化 | ✅ 已实现 |

### 2026-05-30-dashboard-design.md

| 条目 | 状态 |
|------|------|
| 模型列表动态获取 | ❌ 未实现（P1-03, P3-03） |
| 上下文压缩按钮 | ❌ 未实现（P3-01） |
| contextWindow 动态 | ❌ 未实现（P1-05） |
| context_log 持久化 | ❌ 未实现（P3-02） |
| isStreaming 追踪 | ❌ 未实现（P2-01） |
| 模型切换仅空闲时允许 | ❌ 未实现（P1-04） |
| 硬编码清理 | ❌ 未完成（P3-03, P1-03, P1-05） |

---

## 附录 B: 原型 vs 实现差异

通过对比 `layout-mockup-v2.html` 原型与当前实现：

| 原型设计 | 当前实现 | 差距 |
|---------|---------|------|
| 右侧面板展开标签文字 | 写死"记 忆 检 索" | 应改为"展开面板"或动态 |
| 对话区 Header 有角色名 + 电量 | 仅显示"澪号 · 在线/离线" | 缺电量指示 |
| 消息圆角：对方直角 | 已实现 | ✅ |
| 状态栏第 3 行有上下文进度条 | 已实现 | ✅ |
| 面板悬浮间距 margin: 12px, gap: 10px | 已实现 | ✅ |
| 面板拖拽 0~640px | 已实现但拖拽 bug（P0-05） | ⚠️ |
