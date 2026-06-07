# 澪号 Personal Agent — 详细状态报告 v2

> 日期: 2026-06-07 | 上期: [mio-status-2026-06-07](./mio-status-2026-06-07.md)
> 用途: 前端迁移的基线文档，记录当前实际状态与目标架构的差距

---

## 一、整体架构拓扑

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        浏览器 (SolidJS + Tailwind + Vite)                      │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                     App.tsx (68 行) — 硬编码路由                           │ │
│  │                                                                          │ │
│  │  import MiniNav         ← 直接 import, 无注册                             │ │
│  │  import TopMenuBar      ← 直接 import, 无注册                             │ │
│  │  import SettingsPage    ← 直接 import, 绕过 registry                      │ │
│  │  import 6 个 View       ← 全部硬编码, 无注册                               │ │
│  │                                                                          │ │
│  │  renderView() = switch(activeView) { ... }                               │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                          │
│      ┌─────────────────────────────┼─────────────────────────────┐           │
│      ▼                             ▼                             ▼           │
│  ┌──────────────┐    ┌─────────────────────────┐    ┌────────────────────┐  │
│  │ registry.ts  │    │  useAgent.tsx (765行)    │    │ settings-signal.ts │  │
│  │ 10 扩展注册   │    │ WS + 会话 + 消息 + 智能体 │    │ isSettingsOpen()   │  │
│  │ getBySlot()  │    │ + 设置 + 订阅 + 渲染泵    │    │ (游离信号)         │  │
│  │ → 零消费 ❌   │    │ 7 职责混在一起            │    └────────────────────┘  │
│  └──────────────┘    └────────────┬────────────┘                             │
│                                   │                                          │
│                                   │ ws://localhost:9229                      │
│                                   │ 33 client ↑  36 server ↓                 │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Bridge (Node.js + tsx --watch)                        │
│                                                                               │
│  index.ts (125行) — DB + 默认设置 + .pi 配置 + Agent 发现 + WSS + Watcher      │
│  protocol.ts (252行) — 69 条消息 (Spec 设计 55, 代码多 14 条)                   │
│  dispatcher.ts (82行) — 32 路由 (文档说 27, 实际多 5 条)                        │
│  handlers/ (11 文件) — 文档说 7, 实际多 4 (agent/thinking/tools/skills)        │
│  pi-session.ts — Pi SDK 会话管理                                              │
│                                                                               │
│  ❌ pi-adapter.ts 不存在 (Spec 设计的 60 行 Pi 事件翻译器)                       │
│  ❌ 启动逻辑未拆分                                                              │
│  ❌ message.ts 直接 fetch DeepSeek API (破坏翻译层纯粹性)                        │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │ Pi SDK API
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Pi 扩展 (后端 — ✅ 架构健康)                                │
│                                                                               │
│  注册: bridge/.pi/settings.json → 3 个扩展路径                                  │
│  加载: Pi SDK 自动 import → register(api)                                      │
│                                                                               │
│  pa-mio   → api.registerTool + api.on('event') — 人格注入 v5                   │
│  pa-files → api.registerTool + api.registerCommand — 文件浏览                  │
│  pa-mcp   → api.registerTool — MCP 桥接 (Live2D 已于 2026-06-07 清理)          │
│                                                                               │
│  特点: ✅ 扩展独立 ✅ 删除即移除 ✅ 通过 API 通信 ✅ 不互相 import                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、前端扩展系统 — 双重架构并存

### 系统 B (新, 工作中) — Views 层

```
MiniNav (52px, Luci de 图标)
  ├─ 通信 → PencilMainView (1292行 ⚠️ 巨石)
  │          ├─ Sidebar (520行内联) — 会话管理 + Agent列表 + 工具日志 + 资源监视
  │          ├─ ChatPanel (450行内联) — 聊天渲染 + Markdown + HTML + 输入
  │          └─ EditorPanel (170行内联) — 文件标签 + 预览 + 拖拽宽度
  ├─ 識別 → CharacterView (mock 数据, 5 个硬编码 Agent)
  ├─ 記録 → SessionRecordsView (mock 数据)
  ├─ 資源 → CostDashboardView (mock 数据)
  ├─ 文件 → FileTreeView (复用 FileTree 扩展)
  └─ 設定 → SettingsLayoutView (5 子页, 大部分 mock)

注册方式: 无 — App.tsx 硬编码 import
通信方式: useAgent() hook
导航方式: CustomEvent('mio:navigate') 全局事件
```

### 系统 A (旧, 注册但未消费) — Extensions 层

```
Slot 注册情况:
  left-top     → session-panel    ✅注册 ❌未消费
  left-middle  → tool-panel       ✅注册 ❌未消费
  left-bottom  → status-bar       ✅注册 ❌未消费
  center       → chat-renderer    ✅注册 ❌未消费
  right        → right-panel      ✅注册 ❌未消费
  right-tab    → file-tree        ✅注册 ⚠️被 PencilMainView 硬编码 import
  right-tab    → doc-preview      ✅注册 ❌未消费

不注册到 slot 的特殊扩展:
  top-menu      ❌明确不注册 ("Rendered directly in App.tsx")
  settings-page ❌明确不注册 ("Rendered directly in App.tsx")
  mini-nav      ❌无 index.ts 注册文件
```

### Registry 死代码状态

```
registry.ts — 完整实现, 零消费:
  register(ext)   ✅ 10 个扩展调用了
  getBySlot()     ❌ App.tsx 和所有 View 中零调用
  getAll()        ❌ 零调用
  getById()       ❌ 零调用
```

---

## 三、通信数据流

```
用户输入
  │
  ▼
agent.sendMessage()                    ← useAgent.tsx:601
  │ 本地插入 user MessageEntry
  └─ send('agent.prompt', {...})
      │
═══════ WebSocket ═══════════════════════════════════════════════════════
      │
      ▼
dispatcher.ts → handleMessageSend     ← bridge/handlers/message.ts
  │ Pi SDK: agent.prompt(content)
  │ LLM → tool calls → LLM → ...
  ▼
Pi 事件 → WS broadcast               ← 散落在 pi-session.ts (无 pi-adapter)
  │ message.start / delta / end
  │ tool.start / progress / end
  │ turn.start / end / error
═══════ WebSocket ═══════════════════════════════════════════════════════
      │
      ▼
useAgent handleServerMessage()        ← useAgent.tsx:218
  ├─ 更新 Signal (触发 SolidJS 重渲染)
  │   messages() / toolCalls() / status / sessions()
  │
  └─ 分发到扩展订阅者                 ← msgListeners Map
      EditorPanel 订阅 file.content
      其他扩展直接读 Signal
```

---

## 四、协议消息统计 (69 条)

```
Client → Server (33 条)
  智能体管理 (6): agent.list / create / update / delete / switch / set_default
  会话管理 (7):   session.create / list / switch / delete / rename / history / state
  对话控制 (3):   agent.prompt / abort / compact
  配置控制 (4):   model.set / list / thinking.set / tools.set
  文件系统 (3):   file.list / read / write
  设置 (3):       settings.get / set / discover
  记忆 (2):       memory.search / list
  技能 (4):       skills.list / install / toggle / remove
  心跳 (1):       ping

Server → Client (36 条)
  智能体事件 (5): agent.list / created / updated / deleted / default_changed
  会话事件 (6):   session.created / list / renamed / deleted / history / state
  Agent 生命周期 (5): agent.start / end / turn.start / end / error
  消息流 (3):     message.start / delta / end
  工具执行 (3):   tool.start / progress / end
  状态同步 (3):   state.model / thinking / tools
  聚合状态 (1):   status.update
  文件 (3):       file.list / content / changed
  记忆 (2):       memory.results / list
  设置+技能 (3):  settings.state / skills.state / skills.installed
  压缩 (1):       session.compacted
  系统 (1):       error
```

---

## 五、useAgent.tsx 职责地图 (765 行)

```
① WS 连接管理          ~95行    connect / reconnect / heartbeat / pendingSends
② 消息路由 & 状态更新   ~360行   handleServerMessage — 21 个 case
③ 字符逐字渲染泵        ~50行    pumpChars / schedulePump / CHARS_PER_FRAME=15
④ 会话缓存              ~15行    sessionMessages / sessionToolCalls / sessionStatus
⑤ 发送 & 操作方法       ~90行    send / sendMessage / cancelMessage / createSession
                                  switchSession / switchModel / switchAgent ...
⑥ 扩展订阅系统          ~15行    subscribe(type, handler) → unsubscribe
⑦ Context + Hook 导出   ~50行    AgentProvider / useAgent
```

---

## 六、文档 vs 代码偏离度

| 指标 | CLAUDE.md | 实际代码 | 偏离 |
|------|-----------|----------|------|
| App 布局 | Grid + 拖拽 | Flex + 视图切换 | 🔴 完全不同 |
| App.css 行数 | ~170 | 364 | 🔴 +114% |
| Bridge handler 文件 | 7 | 11 | 🔴 +57% |
| 协议消息总数 | 55 | 69 | 🔴 +25% |
| Dispatcher 路由 | 27 | 32 | 🔴 +18% |
| 前端扩展数 | 9 | 10 | 🟡 少1 |
| Settings tab 数 | 4 | 5 | 🟡 少1 |
| Spec 文档数 | 5 | 6 | 🟡 少1 |
| 最新状态文档 | 06-06 | 06-07 | 🟡 过期 |
| views/ 目录 | 未提及 | 6 文件 | 🔴 完全缺失 |
| 注册表消费 | 描述已实现 | 零调用 | 🔴 完全不符 |
| npm run check | 要求通过 | 6 TS 错误 | 🔴 不通过 |
| 8 个通用组件 | ✅ | ✅ | 🟢 一致 |
| 3 个 Pi 扩展 | ✅ | ✅ | 🟢 一致 |
| Live2D 清理 | ✅ | ✅ | 🟢 一致 |

---

## 七、修复优先级

### P0 — 协议对齐 (Step 3 前置条件)

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| P0-1 | 协议命名规范化 | `bridge/protocol.ts` | 统一为 `domain.action` 风格 (model.set→agent.model.set 等), 与 Spec 对齐 |
| P0-2 | 创建 pi-adapter.ts | `bridge/pi-adapter.ts` (新建) | Pi 事件 → 协议消息 纯翻译器, ~60 行 |
| P0-3 | 更新 dispatcher 路由 | `bridge/dispatcher.ts` | 适配新命名 |
| P0-4 | 更新 CLAUDE.md 数字 | `CLAUDE.md` | 55→69 消息, 27→32 路由, 7→11 handler |

### P1 — 前端解耦 (Step 1)

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| P1-1 | 扩展注册表 Slot 设计 | `registry.ts` | 新增 `overlay` / `nav` / `main-view` / `sidebar` slot |
| P1-2 | App.tsx 消费注册表 | `App.tsx` | 改为从 `getBySlot()` 读取扩展渲染, 移除硬编码 import |
| P1-3 | MiniNav 注册化 | `extensions/mini-nav/` | 补 `index.ts`, 改用 context signal 替代 CustomEvent |
| P1-4 | SettingsPage/TopMenuBar 注册化 | `extensions/settings-page/`, `extensions/top-menu/` | 通过 `overlay` slot 注册 |
| P1-5 | PencilMainView 拆分 | `views/PencilMainView.tsx` → 3 个扩展 | Sidebar / ChatPanel / EditorPanel |
| P1-6 | View → Extension 包装 | `views/*/` | 6 个 View 补 index.ts + register, 注册到 `main-view` slot |
| P1-7 | Settings 双轨清理 | 保留 SettingsLayoutView, 移除旧 settings-page |

### P2 — useAgent 拆分 (Step 1 延续)

| # | 任务 | 说明 |
|---|------|------|
| P2-1 | 提取 WS 连接模块 | `use-ws.ts` — connect / reconnect / heartbeat / send |
| P2-2 | 提取会话缓存模块 | `use-session-cache.ts` — sessionMessages / sessionToolCalls Maps |
| P2-3 | 提取字符渲染泵 | `char-pump.ts` — pumpChars / schedulePump |
| P2-4 | 提取设置模块 | `use-settings.ts` — 合并 settings-signal.ts |
| P2-5 | 提取智能体模块 | `use-agents.ts` |
| P2-6 | 保留 useAgent() facade | 向后兼容, 内部组合上述模块 |

### P3 — 通信层强化 (Step 3)

| # | 任务 | 说明 |
|---|------|------|
| P3-1 | subscribe 类型安全 | 泛型化 subscribe, 自动推导 payload 类型 |
| P3-2 | Bridge 启动拆分 | index.ts → init-db + init-config + init-agents |
| P3-3 | Handler 业务逻辑分离 | message.ts 的 DeepSeek fetch → 独立 service |
| P3-4 | 客户端管理统一 | addClient / addSkillClient / addAgentClient → client-manager.ts |

### P4 — 文档同步

| # | 任务 | 文件 |
|---|------|------|
| P4-1 | CLAUDE.md 全面更新 | 目录结构 / 数字 / 架构描述 |
| P4-2 | 更新统一协议 Spec | 匹配 69 条消息 + 多 Agent |
| P4-3 | 新会话接续指向最新文档 | CLAUDE.md Step 4 |

### P5 — 未实现功能 (后续迭代, Step 2 之后)

| # | 任务 | 说明 |
|---|------|------|
| P5-1 | CharacterView 接入实时数据 | useAgent().agents() 替代 mock |
| P5-2 | SessionRecordsView 接入 | useAgent().sessions() 历史 |
| P5-3 | CostDashboardView 接入 | status + stats handler |
| P5-4 | SettingsLayoutView 接入 | 设置读写 + 模型 CRUD |

---

## 八、建议执行顺序

```
Phase 0: 协议对齐 (P0-1 → P0-4)              ← 1-2 个会话
Phase 1: 前端解耦 (P1-1 → P1-7)               ← 3-4 个会话
Phase 2: useAgent 拆分 (P2-1 → P2-6)          ← 2-3 个会话
Phase 3: 通信强化 (P3-1 → P3-4)               ← 2-3 个会话
Phase 4: 文档同步 (P4-1 → P4-3)               ← 1 个会话
Phase 5: 功能补全 (P5-1 → P5-4)               ← 按需
```

---

*本报告为前端迁移基线文档，2026-06-07 生成。*
