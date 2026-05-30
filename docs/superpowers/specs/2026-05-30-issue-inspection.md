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

| 级别 | 含义 | 数量 | 已修复 | 剩余 |
|------|------|------|--------|------|
| 🔴 P0 | 功能完全不可用或数据错误 | 5 | 5 | 0 |
| 🟠 P1 | 功能可用但有明显缺陷 | 12 | 10 | 2 |
| 🟡 P2 | 体验 / 健壮性 / 边界情况 | 7 | 7 | 0 |
| ⚪ P3 | 规范偏离 / 技术债务 / 未实现项 | 10 | 8 | 2 |
| **合计** | | **34** | **30** | **4** |

> 最后更新：2026-05-31

---

## 🔴 P0 · 阻断级

### ✅ P0-01: 文件树首次加载永久卡死

> **已修复** — `5e127f0` + `047d1b0`：useAgent 增加 `pendingSends` 队列，WS `onopen` 后自动刷待发送消息。

---

### ✅ P0-02: 对话区双重输入框

> **已修复** — `5e127f0`：删除 `ChatInput` 扩展注册，ChatRenderer 已含完整输入功能。

---

### ✅ P0-03: MemoryView 与后端部分断开

> **部分修复** — 前端已改为从桥接请求数据。后端 memory handler 仍使用内存数组（见 P3-08）。

---

### ✅ P0-04: 右侧面板关闭按钮无效

> **已修复** — `047d1b0`：App.tsx 在 `onMount` 中监听 `close-right-panel` 自定义事件。

---

### ✅ P0-05: 拖拽把手不工作

> **已修复** — `047d1b0`：App.tsx 重写拖拽逻辑，mouseMove 计算正确 + `dragging` class 管理。

---

## 🟠 P1 · 功能缺陷

### ✅ P1-01: 会话刷新后引用文件内容全部展开

> **已修复** — `36e7c31`：消息协议增加 `displayContent` 字段，AI context 用完整内容，UI 展示用简化版。附件消息持久化后渲染为徽章而非展开内容。

---

### ✅ P1-02: 文件树切换标签后重新加载

> **已修复** — `5e127f0`：RightPanelTabs 改用 CSS `display:none/block` 替代 `<Switch>`/`<Match>`，保持 DOM 存活。

---

### ✅ P1-03: 模型下拉列表硬编码

> **已修复** — `5e127f0` + `047d1b0`：`model.list` → Pi `modelRegistry.getAll()` → `status.update.availableModels` → StatusBar 动态渲染。

---

### ✅ P1-04: 模型切换返回假数据

> **已修复** — `5e127f0` + `e380a1b`：`handleModelSwitch` 返回 Pi session 真实数据（model.id / contextUsage / roundCount），对话中切换返回 BUSY 错误。

---

### ✅ P1-05: 上下文最大值仍硬编码

> **已修复** — `e380a1b`：`contextMax` 从 `ctx.contextWindow ?? session.model?.contextWindow` 动态获取。useAgent 初始值改为 0。

---

### ❌ P1-06: 会话历史消息 partial 始终为 false

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

### ❌ P1-07: session.switch 懒创建时不检查 isStreaming

**现状：** `session.ts:266` 使用 `(session as any).isStreaming` 绕过 Pi SDK 类型。功能可用但类型不安全。

---

### ✅ P1-08: DocPreview 订阅无 session 过滤

> **已修复** — DocPreview.tsx:34 已加入 `msg.sessionId !== agent.sessionId()` 过滤。

---

### ✅ P1-09: useAgent status 合并逻辑bug

> **已修复** — `5e127f0`：改用 Solid Store 的 `setStatus('key', value)` 逐字段更新，避免 `{ ...status }` 快照覆盖问题。

---

### ✅ P1-10: model.list 响应类型不安全

> **已修复** — `e380a1b`：`StatusPayload` 已包含 `availableModels` 可选字段，`handleModelList` 发送完整 payload。

---

### ❌ P1-11: memory.search / memory.list 无持久化

**现状：** `memory.ts:4-8` 仍使用内存数组。前端 MemoryView 已改为从桥接请求。待迁移到 SQLite。

---

### ✅ P1-12: FileTree 构造的 path 在 Windows 上有问题

> **已修复** — `289e479`：`setDirChildren` key 用归一化路径，统一 `/` 分隔。

---

## 🟡 P2 · 体验 / 健壮性

### ✅ P2-01: 无 isStreaming 状态追踪
> **已修复** — `5e127f0`：useAgent 新增 `isStreaming` signal，StatusBar 模型下拉/压缩按钮在流式时禁用。

### ✅ P2-02: WS 断连无用户提示
> **已修复** — `5e127f0`：指数退避重连（3s→6s→12s→30s cap），断连后自动恢复。

### ✅ P2-03: 消息列表空态
> **已修复** — ChatRenderer 空消息时显示"向澪发送消息开始对话"引导文案。

### ✅ P2-04: 工具面板详情可读性差
> **已修复** — ToolPanel 改用 `summarizeInput()` 显示工具名 + 第一个有意义参数。

### ✅ P2-05: 关闭右面板时无状态保存
> **已修复** — 与 P1-02 一同修复，面板隐藏（`display:none`）而非 DOM 销毁。

### ✅ P2-06: 附件拖放区域视觉反馈不完整
> **已修复** — 拖放手柄区高亮 border 脉冲动画。

### ✅ P2-07: 子会话列表空态无引导
> **已修复** — SessionPanel 无子会话时显示"暂无子会话，点击 + 创建"。

---

## ⚪ P3 · 规范偏离 / 技术债务

### ✅ P3-01: session.compact 未实现
> **已修复** — `c0cca31`：dispatcher 路由 → handleSessionCompact → 前端压缩按钮 + 响应处理。

### ✅ P3-02: context_log 表未创建
> **已修复** — `5e127f0`：db.ts 创建 context_log 表，agent_end 写入记录。

### ✅ P3-03: MODEL_MAP 残留
> **已修复** — `5e127f0`：MODEL_MAP 改为注释保留（文档用途），主逻辑从 registry 读取。

### ✅ P3-04: isStreaming 未实现
> **已修复** — `5e127f0`：同 P2-01。

### ✅ P3-05: StatusPayload 缺字段
> **已修复** — `protocol.ts` 已包含 `model?`、`availableModels?` 字段。

### ✅ P3-06: 重命名 handler 无防注入
> **已修复** — `session.ts:198`：title 限制 100 字符 + sanitize HTML 标签。

### ✅ P3-07: ChatRenderer + ChatInput 冗余
> **已修复** — 与 P0-02 一同处理，删除 chat-input 注册。

### ❌ P3-08: memory handler 架构不符合 spec
**现状：** 前后端仍为 demo 数据。需 SQLite `memories` 表 + FTS5 搜索。与 P1-11 同一任务。

### ✅ P3-09: 消息模型 display vs context 混用
> **已修复** — 消息协议增加 `displayContent`，ChatRenderer 发送时分离 AI context 和 UI display。

### ❌ P3-10: TypeScript 类型缺口
**现状：** Pi SDK 类型不完整导致 `(session as any).model` / `(session as any).isStreaming` 等多处 `as any`。Pi 升级后逐步消除。

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

```

---

## 剩余待修复（4 项）

| 编号 | 问题 | 优先级 | 说明 |
|------|------|--------|------|
| P1-06 | `partial: false` 硬编码 | 🟠 P1 | session.history 组装时写死 false |
| P1-07 | `(session as any).isStreaming` | 🟠 P1 | Pi SDK 类型缺口，功能可工作 |
| P1-11/P3-08 | Memory 无 SQLite 持久化 | 🟠/⚪ | 前后端仍用内存数组 |
| P3-10 | TypeScript 类型缺口 | ⚪ P3 | Pi SDK 类型不完整导致多处 `as any` |

---

## 附录 A: Spec 对照清单

### 2026-05-30-frontend-layout-design.md

| 条目 | 状态 |
|------|------|
| Grid 布局 3 列 3 行 | ✅ |
| 全部悬浮 + 玻璃拟态 | ✅ |
| 会话面板（主会话 + 子列表） | ✅ |
| 工具面板（表头 + 条目 + 展开） | ✅ |
| 状态栏（时钟 + token + 上下文） | ✅ |
| 对话区（消息列表 + 气泡 + 输入） | ✅ |
| 右侧可拖拽面板 | ✅ |
| 文件树 | ✅ |
| 文档预览（Markdown + 源码切换） | ✅ |
| 记忆检索 | ❌ P3-08 |
| 扩展机制 | ✅ |
| WebSocket 协议 | ✅ |

### 2026-05-30-session-management-design.md

| 条目 | 状态 |
|------|------|
| 主会话「澪」不可删除 | ✅ |
| 子会话 CRUD | ✅ |
| 历史消息持久化 | ✅ |
| AI 自动命名 | ✅ |
| 工具调用持久化 | ✅ |
| 会话切换 | ✅ |
| session.history | ⚠️ partial 始终 false（P1-06） |
| 附件元数据持久化 | ✅ |

### 2026-05-30-dashboard-design.md

| 条目 | 状态 |
|------|------|
| 模型列表动态获取 | ✅ |
| 上下文压缩按钮 | ✅ |
| contextWindow 动态 | ✅ |
| context_log 持久化 | ✅ |
| isStreaming 追踪 | ✅ |
| 模型切换仅空闲时允许 | ✅ |
| 硬编码清理 | ✅ |

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
| 面板拖拽 0~640px | ✅ | — |
