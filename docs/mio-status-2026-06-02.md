# 澪号 Personal Agent 项目状态

> 日期: 2026-06-02 | 上期: [2026-06-01](./mio-status-2026-06-01.md)

---

## 一、架构总览

```
┌─ 浏览器 (SolidJS + Tailwind + PIXI/Cubism) ──────────────────────┐
│                                                                     │
│  App.tsx ─── 壳层渲染                                              │
│  ├─ SceneLayer          ← Live2D 背景场景                          │
│  ├─ TopMenuBar          ← 顶部菜单（设置入口 + 主会话入口）         │
│  ├─ SettingsPage        ← 全屏设置覆盖层（模型/厂商/Live2D 控制）  │
│  ├─ Live2DView          ← 悬浮 Live2D 看板（可拖拽+缩放）          │
│  └─ Overlay (Grid 布局) ← 对话 + 面板区                            │
│      ├─ left-top        ← 会话面板                                 │
│      ├─ left-middle     ← 文件树 + 工具面板                        │
│      ├─ left-bottom     ← 状态栏                                   │
│      ├─ center          ← 对话渲染 + 输入框                        │
│      └─ right           ← 文档预览 / 记忆检索                      │
│                                                                     │
└──────────────┬──────────────────────────────────────────────────────┘
               │ WebSocket (ws://localhost:9229)
               ▼
┌─ Bridge (Node.js + Pi Agent SDK) ──────────────────────────────────┐
│                                                                     │
│  index.ts ── WebSocket Server + SQLite 初始化 + Live2D 中继        │
│  dispatcher.ts ── 消息路由（7 个 handler，19 个消息类型）           │
│  pi-session.ts ── Pi 会话管理 + 模型注册表                         │
│  watcher.ts ── 文件监听 + 广播                                     │
│  db.ts ── SQLite 持久化层                                          │
│                                                                     │
└──────────────┬──────────────────────────────────────────────────────┘
               │ HTTP
               ▼
┌─ Pi Extension Chain ───────────────────────────────────────────────┐
│                                                                     │
│  pa-mio (v4) ─── 人格注入 + 意图分类 + 记忆工具                    │
│  pa-files ────── 文件浏览/预览工具                                 │
│  pa-live2d ───── Live2D 表情/动作/状态工具                         │
│                                                                     │
└──────────────┬──────────────────────────────────────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   DeepSeek API   Anthropic API
        │             │
        ▼             ▼
   LLM 推理        LLM 推理

MCP Server (独立进程):
  mcp-servers/live2d/ ─── Live2D 控制 (STDIO JSON-RPC)
                           ↔ Bridge WebSocket 中继
                           ↔ 浏览器 Live2DView
```

**外部依赖**: 无。Live2D 模型文件由 Vite 静态托管（`frontend/public/live2d/`），Cubism SDK 通过 `<script>` 从 `/vendor/` 加载

---

## 二、已完成系统

### 2.1 人格系统 (pa-mio v4) ✅

| 维度 | 说明 |
|------|------|
| 人格定义 | `mio-harness/SOUL.md`，~800 chars，行为规则式 |
| Prompt 组装 | 5 层: SOUL → 记忆快照 → 注入上下文 → Pi 工具 → 模式指令 |
| 意图分类 | 18 条中文正则 → chat（闲聊免工具）/ agent（可调工具）双模式 |
| 思考分离 | `thinking_delta` 与 `text_delta` 分开，前端默认折叠 |
| 热更新 | SOUL.md 改文件立即生效，记忆快照在新会话后更新 |

### 2.2 记忆系统 (Hermes 风格) ✅

| 维度 | 说明 |
|------|------|
| 文件存储 | `mio-harness/memories/MEMORY.md` (≤2200 chars) + `USER.md` (≤1375 chars) |
| 条目格式 | `§ 声明式事实`，**过去完成时** |
| 写入 | `memory_add(target, content)` → 原子写入 (tempfile + fsync + rename) |
| 读取 | `memory_read(target)` → 返回全文 |
| 安全 | 写入前扫描 prompt injection 模式 |
| 快照 | 实时读取，memory_add 写入后下轮 Prompt 可见 |

**当前记忆内容**:
- MEMORY.md: 6 条 § 条目（项目偏好、技术栈、扩展机制等）
- USER.md: 17 条 § 条目（Mirror 画像：技术、音乐、游戏、性格）

### 2.3 设置系统 ✅

| 功能 | 状态 |
|------|------|
| 模型厂商接入 | DeepSeek + Anthropic（Architect 预留 15 厂商） |
| 模型发现 | `settings.discover-models` 自动扫描已配 Key 的厂商 |
| 模型切换 | 设置页面 / 顶部菜单入口 |
| 默认参数 | 默认模型、思考强度、压缩阈值 — SQLite 持久化 |
| Live2D 控制 | 设置页面集成：尺寸、缩放、偏移、重置 |

### 2.4 Live2D 系统 ✅

| 成果 | 说明 |
|------|------|
| 模型 | 卡拉 — 16 个内置表情 + 3 个自定义参数表情 + 1 个表情序列 (Scene1) |
| 悬浮面板 | 右下角悬浮窗，可拖拽调整大小、缩放、偏移 |
| 独立测试 | `live2d-test-v2.html` — SDK 加载+模型渲染+表情切换全通过 |
| Pi 工具 | `live2d_expression` / `live2d_motion` / `live2d_status` 三个 LLM 工具 |
| MCP Server | `mcp-servers/live2d/` — STDIO JSON-RPC 协议 |
| Bridge 中继 | `live2d.control` / `live2d.result` 消息类型，WebSocket 广播 |
| 鬼影模式 | 悬浮面板右上角按钮切换透明状态 |

### 2.5 会话管理 ✅

| 功能 | 说明 |
|------|------|
| 多会话 | 创建/切换/删除/重命名，主会话「澪」默认存在 |
| 历史加载 | 切换会话自动回填历史消息 |
| 自动命名 | 首次对话后 DeepSeek 自动生成 3-5 字标题 |
| 上下文压缩 | 可配置阈值，自动 compact |
| 状态跟踪 | 当前模型/思考级别/上下文用量/轮次数 |

### 2.6 基础设施 ✅

| 功能 | 说明 |
|------|------|
| Bridge 热重载 | `tsx watch` 自动重启 bridge 自身代码 |
| 前端 HMR | Vite 热模块替换 |
| WebSocket | 单连接复用，心跳保活 |
| 数据库 | SQLite (`~/.personal-agent/agent.db`)，Conversations + Messages + Settings 三表 |
| Pi 扩展注册 | `bridge/.pi/settings.json` 注册 pa-mio + pa-files + pa-live2d |
| Git | 已连接 GitHub，5 个分支（master + archive/legacy + 2 feat + 1 worktree） |

---

## 三、前端扩展清单（11 个）

| # | 扩展 ID | 目录 | 渲染方式 | Slot | 功能 |
|---|---------|------|----------|------|------|
| 1 | `top-menu` | top-menu/ | App.tsx 直接导入 | — | 顶部菜单栏（设置入口+主会话入口） |
| 2 | `settings-page` | settings-page/ | App.tsx 直接导入 | — | 全屏设置覆盖层（模型/厂商/Live2D） |
| 3 | `live2d-view` | live2d-view/ | App.tsx 直接导入 | — | 悬浮 Live2D 角色看板 |
| 4 | `chat-input` | chat-input/ | registry（已注释） | center | 对话输入框+附件+发送 |
| 5 | `chat-renderer` | chat-renderer/ | registry | center | 消息气泡渲染+思考折叠 |
| 6 | `session-panel` | session-panel/ | registry | left-top | 会话列表+切换+删除 |
| 7 | `file-tree` | file-tree/ | registry | left-middle | 文件树浏览 |
| 8 | `tool-panel` | tool-panel/ | registry | left-middle | 工具调用状态/结果 |
| 9 | `doc-preview` | doc-preview/ | registry | right | 文档内容预览 |
| 10 | `right-panel` | right-panel/ | registry | right | 右侧面板 Tab 切换 |
| 11 | `status-bar` | status-bar/ | registry | left-bottom | 状态栏（tokens/费用/模型/连接） |

> **注**: top-menu、settings-page、live2d-view 因需要特殊渲染位置（最顶层覆盖/固定定位），不走 registry 体系，由 App.tsx 直接渲染。chat-input 的 registry 已注释（同样原因）。

---

## 四、Bridge 路由表（18 个消息类型）

| 消息类型 | Handler | 方向 | 说明 |
|----------|---------|------|------|
| `session.create` | handleSessionCreate | C→S | 创建新会话 |
| `session.list` | handleSessionList | C→S | 列出所有会话 |
| `session.switch` | handleSessionSwitch | C→S | 切换当前会话 |
| `session.delete` | handleSessionDelete | C→S | 删除会话 |
| `session.history` | handleSessionHistory | C→S | 加载会话历史 |
| `session.rename` | handleSessionRename | C→S | 重命名会话 |
| `session.state` | handleSessionState | C→S | 查询会话状态 |
| `session.compact` | handleSessionCompact | C→S | 压缩上下文 |
| `message.send` | handleMessageSend | C→S | 发送消息 |
| `message.cancel` | handleMessageCancel | C→S | 取消生成 |
| `model.switch` | handleModelSwitch | C→S | 切换模型 |
| `model.list` | handleModelList | C→S | 列出可用模型 |
| `file.list` | handleFileList | C→S | 列出目录文件 |
| `file.read` | handleFileRead | C→S | 读取文件内容 |
| `memory.search` | handleMemorySearch | C→S | 搜索记忆 |
| `memory.list` | handleMemoryList | C→S | 列出所有记忆 |
| `settings.get` | handleSettingsGet | C→S | 获取所有设置 |
| `settings.set` | handleSettingsSet | C→S | 写入设置 |
| `settings.discover-models` | handleSettingsDiscoverModels | C→S | 发现可用模型 |

---

## 五、Shell 层核心模块

| 文件 | 说明 |
|------|------|
| `shell/useAgent.tsx` | 全局状态管理（messages, sessions, toolCalls, status）+ WebSocket 连接 |
| `shell/App.tsx` | 壳组件：Grid 布局 + 右侧面板拖拽 + 扩展渲染 |
| `shell/App.css` | 玻璃拟态 UI 样式（~41KB，完整视觉系统） |
| `shell/live2d-signal.ts` | Live2D 面板参数全局信号（尺寸/缩放/偏移/可见性） |
| `shell/settings-signal.ts` | 设置页面开关全局信号 |
| `shell/SceneLayer.tsx` | Live2D 场景背景层（预留） |
| `registry.ts` | 扩展注册表（Slot-based 插件系统） |

---

## 六、待完成 / 进行中

### 6.1 MCP → Bridge → 浏览器 端到端联调 🟡

- MCP Server STDIO 通信 ✅
- Bridge `live2d.control` / `live2d.result` 中继 ✅
- 前端 Live2DView SolidJS 组件 ✅
- Bridge → 浏览器 WebSocket 中继 ✅（2026-06-03 端到端测试通过）
- Pi → MCP Server 子进程启动 ❌

### 6.2 Pi mcporter 配置 ❌

- MCP Server 已可用 STDIO 协议独立运行
- Pi 需配置 mcporter 自动启动 MCP Server 子进程
- LLM 通过 `tools/call` 调用 `live2d_expression` 未联调

### 6.3 表情自动匹配 ❌

当前 LLM 需手动调用 `live2d_expression` 工具。理想：LLM 回复时根据语气自动匹配表情。

### 6.4 其他待办

- ~~前端文件变动时不触发 Bridge 重启（watcher 已排除 frontend/ .claude/ vendor/）~~ ✅
- 用户目录/文件的完整读写路径权限控制
- 前端深色/浅色模式切换

---

## 七、文件索引（完整目录树）

```
personal-agent/
├── CLAUDE.md                             ← Developer guide（每次新会话先读）
├── README.md                             ← 项目介绍
├── package.json                          ← monorepo root（concurrently 双启动）
├── .env                                  ← DEEPSEEK_API_KEY
├── .gitignore                            ← node_modules, dist, .env, *.db
│
├── bridge/                               ← Node.js 桥接服务器
│   ├── .pi/settings.json                 ←   Pi 扩展注册（3 个扩展）
│   ├── index.ts                          ←   入口：WS Server + SQLite + Live2D 中继
│   ├── protocol.ts                       ←   消息类型定义（前端共享）
│   ├── dispatcher.ts                     ←   消息路由表（18 路由）
│   ├── pi-session.ts                     ←   Pi 会话管理 + 模型注册表
│   ├── watcher.ts                        ←   文件监听 + 客户端广播
│   ├── db.ts                             ←   SQLite 初始化
│   └── handlers/
│       ├── session.ts                    ←     会话 CRUD + 历史 + 压缩
│       ├── message.ts                    ←     消息发送/取消 + 自动命名
│       ├── model.ts                      ←     模型切换/列表
│       ├── file.ts                       ←     文件列表/读取
│       ├── memory.ts                     ←     记忆搜索/列表
│       ├── memory-store.ts               ←     Bridge 侧记忆读写
│       └── settings.ts                   ←     设置 CRUD + 模型发现
│
├── frontend/                             ← SolidJS 前端
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── index.tsx                     ←   入口
│       ├── index.css                     ←   全局样式
│       ├── registry.ts                   ←   扩展注册表
│       ├── shell/
│       │   ├── App.tsx                   ←     壳组件：Grid + 面板拖拽
│       │   ├── App.css                   ←     玻璃拟态 UI 全样式
│       │   ├── useAgent.tsx              ←     全局状态 + WS hook
│       │   ├── live2d-signal.ts          ←     Live2D 信号
│       │   ├── settings-signal.ts        ←     设置信号
│       │   └── SceneLayer.tsx            ←     Live2D 场景层
│       └── extensions/
│           ├── chat-input/               ←     对话输入框
│           ├── chat-renderer/            ←     消息气泡渲染
│           ├── session-panel/            ←     会话面板
│           ├── file-tree/                ←     文件树
│           ├── tool-panel/               ←     工具面板
│           ├── doc-preview/              ←     文档预览
│           ├── top-menu/                 ←     顶部菜单栏
│           ├── settings-page/            ←     设置页面
│           ├── status-bar/               ←     状态栏
│           ├── right-panel/              ←     右侧面板 Tab
│           └── live2d-view/              ←     悬浮 Live2D 看板
│               ├── index.ts
│               └── Live2DView.tsx
│
├── extensions/                           ← Pi 扩展（PA SDK）
│   ├── pa-mio/index.ts                   ←   人格注入 v4
│   ├── pa-files/index.ts                 ←   文件浏览工具
│   ├── pa-live2d/index.ts               ←   Live2D 控制工具
│   └── shared/memory-store.ts            ←   记忆读写核心（§ 文件操作）
│
├── mcp-servers/live2d/                   ← MCP Server（独立进程）
│   ├── index.ts                          ←   JSON-RPC over STDIO
│   ├── test.ts                           ←   协议测试
│   └── package.json
│
├── mio-harness/                          ← 角色数据
│   ├── SOUL.md                           ←   人格定义（~800 chars）
│   └── memories/
│       ├── MEMORY.md                     ←   环境/项目记忆（6 条 § 条目）
│       └── USER.md                       ←   用户画像（17 条 § 条目）
│
├── frontend-sketch/                      ← UI 原型（设计源）
│   ├── layout-mockup-v2.html            ←   主界面原型（85KB）
│   ├── live2d-standalone-test.html      ←   独立 Live2D 测试
│   ├── live2d-test-v2.html              ←   参数表情测试
│   ├── live-mode-prototype-v2.html      ←   LIVE 模式原型
│   ├── live-mode-corner.html            ←   角落模式原型
│   ├── live-mode-floating.html          ←   悬浮模式原型
│   ├── live-mode-prototype.html         ←   LIVE 模式原型 v1
│   ├── three-panel-layout.html          ←   三栏布局原型
│   └── API.md                           ←   EchoBot API 文档
│
├── mio-data/                             ← 澪号角色设计资料
├── vendor/pi/                            ← Pi SDK fork（不修改）
├── docs/
│   ├── mio-status-2026-06-01.md         ←   上一期状态
│   ├── mio-status-2026-06-02.md         ←   本文档
│   └── superpowers/
│       ├── specs/                        ←   设计 Specs（8 份）
│       │   ├── 2026-05-30-dashboard-design.md
│       │   ├── 2026-05-30-file-system-design.md
│       │   ├── 2026-05-30-frontend-layout-design.md
│       │   ├── 2026-05-30-issue-inspection.md
│       │   ├── 2026-05-30-session-management-design.md
│       │   ├── 2026-05-31-settings-system-design.md
│       │   ├── 2026-06-01-mio-persona-memory-refactor.md
│       │   └── 2026-06-02-godot-migration.md
│       ├── plans/                        ←   实现计划（7 份）
│           ├── 2026-05-30-file-system-plan.md
│           ├── 2026-05-30-frontend-implementation.md
│           ├── 2026-05-30-session-management-plan.md
│           ├── 2026-05-31-settings-system.md
│           ├── 2026-06-01-live2d-integration.md
│           ├── 2026-06-01-mio-persona-memory-refactor.md
│           └── 2026-06-02-godot-migration.md
│
└── .superpowers/                         ← Superpowers 运行时数据
```

---

## 八、最近提交（截至 2026-06-03）

```
c42541f docs: 建立 CHANGELOG 机制 + 更新 Git 提交规则
025f8e6 fix: 代码审计修复 — 路径移植+模型匹配+扩展加载+watcher风暴
a574f77 fix: 脱敏 mio-harness — 移除 USER.md，SOUL/MEMORY 去个人化
3605aec feat: 自动化测试套件 + 2个 bug 修复
7158e7c docs: 文档更新 — 目录结构/功能清单/进度同步
848e809 feat: 活人感 + 记忆实时更新
66c620d fix: 移除悬浮窗滚轮缩放（防误触），修复重置按钮样式
```

---

## 九、运行方式

```bash
# 终端 1 — Bridge (端口 9229)
cd personal-agent/bridge && npm run dev

# 终端 2 — 前端 (端口 5173)
cd personal-agent/frontend && npm run dev

# 一键启动
cd personal-agent && npm run dev
```

浏览器打开 `http://localhost:5173`。

---

## 十、进度概览

| 系统 | 进度 | 备注 |
|------|------|------|
| 人格系统 (pa-mio v4) | ✅ 100% | SOUL.md + 5 层 Prompt + 意图分类 |
| 记忆系统 (Hermes) | ✅ 100% | MEMORY.md/USER.md + 原子写入 + 快照 |
| 设置系统 | ✅ 100% | 厂商/模型/参数 + SQLite + 发现 |
| 会话管理 | ✅ 100% | CRUD + 历史 + 自动命名 + 压缩 |
| 文件浏览 | ✅ 100% | 树形浏览 + 内容预览 |
| Live2D 基础 | ✅ 100% | 模型渲染 + 表情 + MCP Server |
| Live2D 前端渲染 | ✅ 100% | SolidJS 组件完成 |
| MCP 端到端链路 | 🟡 70% | Bridge↔Browser 通，Pi→MCP 待联调 |
| Pi mcporter | ❌ 0% | 自动启动 MCP 子进程 |
| 表情自动匹配 | ❌ 0% | 语气→表情映射 |
| 深色/浅色模式 | ❌ 0% | 未开始 |
