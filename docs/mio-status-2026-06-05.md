# 澪号 Personal Agent 项目状态

> 日期: 2026-06-05 | 上期: [2026-06-02](./mio-status-2026-06-02.md)

---

## 一、架构总览

```
┌─ 浏览器 (SolidJS + Tailwind) ────────────────────────────────────┐
│                                                                     │
│  App.tsx ─── 壳层渲染                                              │
│  ├─ TopMenuBar          ← 顶部菜单（设置入口）                      │
│  ├─ SettingsPage        ← 全屏设置覆盖层（模型/参数/工作目录）      │
│  └─ Overlay (Grid 布局) ← 对话 + 面板区                            │
│      ├─ left-top        ← 会话面板                                 │
│      ├─ left-middle     ← 工具面板                                │
│      ├─ left-bottom     ← 状态栏                                   │
│      ├─ center          ← 对话渲染 + 输入框                        │
│      └─ right           ← 文件树 / 文档预览 (Tab 切换)             │
│                                                                     │
└──────────────┬──────────────────────────────────────────────────────┘
               │ WebSocket (ws://localhost:9229)
               ▼
┌─ Bridge (Node.js + Pi Agent SDK) ──────────────────────────────────┐
│                                                                     │
│  index.ts ── WebSocket Server + SQLite 初始化                       │
│  dispatcher.ts ── 消息路由（7 handler，19 消息类型）                │
│  pi-session.ts ── Pi 会话管理 + 模型注册表                         │
│  watcher.ts ── 文件监听 + 广播                                     │
│  db.ts ── SQLite 持久化层                                          │
│                                                                     │
└──────────────┬──────────────────────────────────────────────────────┘
               │
┌─ Pi Extension Chain ───────────────────────────────────────────────┐
│                                                                     │
│  pa-mio (v4) ─── 人格注入 + 意图分类 + 记忆工具 + 工作目录感知     │
│  pa-files ────── 文件浏览/预览工具（动态工作目录）                  │
│  pa-mcp ──────── 通用 MCP 客户端桥接                               │
│                                                                     │
└──────────────┬──────────────────────────────────────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   DeepSeek API   外部 MCP Server
```

**外部依赖**: DeepSeek API（通过 Pi SDK 调用）。无 Live2D 依赖。

---

## 二、已完成系统

### 2.1 人格系统 (pa-mio v5) ✅

| 维度 | 说明 |
|------|------|
| 人格定义 | `mio-harness/SOUL.md`，~3.3KB，5 模块结构化（角色定义/关系性/发言风格/对话示例/禁用词） |
| Prompt 组装 | 4 层: SOUL → 记忆全文 → 检索记忆 + 工作目录 → Pi 工具（+ Pi 底层对话历史） |
| 工具调用 | 无意图分类，LLM 自行决定何时调用工具 |
| 热更新 | SOUL.md 改文件立即生效，memory_add 写入下轮 Prompt 可见 |
| 工作目录感知 | `<recall>` 围栏注入当前 `work_dir`，智能体自然感知 |

### 2.2 记忆系统 (Hermes 风格) ✅

| 维度 | 说明 |
|------|------|
| 文件存储 | `mio-harness/memories/MEMORY.md` (≤2200 chars) + `USER.md` (≤1375 chars) |
| 条目格式 | `§ 声明式事实` |
| 写入 | `memory_add(target, content)` → 原子写入 + 下轮 Prompt 立即可见 |
| 读取 | `memory_read(target)` → 返回全文 |
| 安全 | 写入前扫描 prompt injection 模式 |

### 2.3 设置系统 ✅

| 功能 | 状态 |
|------|------|
| 模型厂商接入 | DeepSeek（其他厂商预留） |
| 模型发现 | `settings.discover-models` 自动扫描 |
| 默认参数 | 默认模型、思考强度、压缩阈值、历史保留 — SQLite 持久化 |
| **工作目录** | 文本输入，`onBlur`/`Enter` 提交，三线打通（面板+工具+prompt） |

### 2.4 工作目录系统（2026-06-05 新增）✅

| 层级 | 改动 | 效果 |
|------|------|------|
| 桥接 | `resolveSafe` 支持绝对路径 | 放行自定义目录 |
| 前端设置页 | 新增"工作目录"输入框 | 用户配置入口 |
| 文件面板 | 订阅 `settings.state`，动态切换根目录 | 面板自动刷新 |
| pa-files | `getWorkspaceRoot()` 动态读 SQLite | 工具操作指向正确目录 |
| pa-mio | `<recall>` 围栏注入工作目录 | 智能体感知当前目录 |

### 2.5 会话管理 ✅

| 功能 | 说明 |
|------|------|
| 多会话 | 创建/切换/删除/重命名，主会话「澪」默认存在 |
| 历史加载 | 切换会话自动回填历史消息 |
| 自动命名 | 首次对话后 DeepSeek 自动生成标题 |
| 上下文压缩 | 可配置阈值，自动 compact |

### 2.6 基础设施 ✅

| 功能 | 说明 |
|------|------|
| Bridge | `tsx` 手动重启（无 watch） |
| 前端 HMR | Vite 热模块替换 |
| WebSocket | 单连接复用，心跳保活 |
| 数据库 | SQLite (`~/.personal-agent/agent.db`)，5 表 |
| Git | 已连接 GitHub |

---

## 三、前端扩展清单（9 个）

| # | 扩展 ID | 目录 | Slot | 功能 |
|---|---------|------|------|------|
| 1 | `top-menu` | top-menu/ | —（App.tsx 直接渲染） | 顶部菜单栏 |
| 2 | `settings-page` | settings-page/ | —（App.tsx 直接渲染） | 全屏设置覆盖层（模型/参数/工作目录） |
| 3 | `chat-renderer` | chat-renderer/ | center | 消息气泡渲染 + 思考折叠（5 组件：ChatRenderer/MessageBubble/ThinkingBlock/ChatInput/Avatar） |
| 4 | `session-panel` | session-panel/ | left-top | 会话列表 + 切换 |
| 5 | `file-tree` | file-tree/ | right-tab | 文件树浏览（工作目录感知） |
| 6 | `tool-panel` | tool-panel/ | left-middle | 工具调用状态 |
| 7 | `doc-preview` | doc-preview/ | right-tab | 文档内容预览 |
| 8 | `right-panel` | right-panel/ | right | 右侧面板 Tab 切换 |
| 9 | `status-bar` | status-bar/ | left-bottom | 状态栏（tokens/费用/模型/连接） |

---

## 四、Bridge 路由表（19 路由 + 7 handler）

| 消息类型 | Handler | 说明 |
|----------|---------|------|
| `session.create/list/switch/delete/history/rename/state/compact` | session.ts | 会话 CRUD + 历史 + 压缩 |
| `message.send/cancel` | message.ts | 消息发送/取消 + 自动命名 |
| `model.switch/list` | model.ts | 模型切换/列表 |
| `file.list/read` | file.ts | 文件列表/读取（支持工作目录） |
| `memory.search/list` | memory.ts | 记忆搜索/列表 |
| `settings.get/set/discover-models` | settings.ts | 设置 CRUD + 模型发现 |

---

## 五、Shell 层核心模块

| 文件 | 说明 |
|------|------|
| `frontend/src/shell/useAgent.tsx` | 全局状态管理 + WebSocket 连接 + 逐字渲染泵 |
| `frontend/src/shell/App.tsx` | 壳组件：Grid 布局 + 面板拖拽 + 扩展渲染 |
| `frontend/src/shell/App.css` | 玻璃拟态 UI 全样式 |
| `frontend/src/shell/settings-signal.ts` | 设置页面开关全局信号 |
| `frontend/src/registry.ts` | 扩展注册表（Slot-based 插件系统） |

---

## 六、已移除

### Live2D 集成（已完全移除）

| 移除内容 | Commit | 说明 |
|----------|--------|------|
| `extensions/pa-live2d/` | `d99532c` | Pi 扩展（MCP 替代） |
| `frontend/.../live2d-view/` | `03da3ee` | 悬浮 Live2D 看板组件 |
| `frontend/.../SceneLayer.tsx` | `03da3ee` | Live2D 场景背景层 |
| `frontend/.../live2d-signal.ts` | `03da3ee` | Live2D 参数信号 |
| Bridge Live2D 中继 | `6c3e604` | `live2d.control/result` 消息 |
| SettingsPage Live2D Tab | `b649da7` | 设置页 Live2D 控制 |
| `mcp-servers/live2d/` | `d64fa4e` | 旧 MCP server（新 adapter 替代） |

`packages/live2d-pet/` 保留为独立 Electron 项目，通过标准 MCP 协议由任意智能体调用，与主应用无耦合。

---

## 七、运行方式

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

## 八、进度概览

| 系统 | 进度 | 备注 |
|------|------|------|
| 人格系统 (pa-mio v4) | ✅ 100% | SOUL.md + 6 层 Prompt + 意图分类 + 工作目录感知 |
| 记忆系统 (Hermes) | ✅ 100% | MEMORY.md/USER.md + 原子写入 + 快照 |
| 设置系统 | ✅ 100% | 厂商/模型/参数 + 工作目录 + SQLite |
| 工作目录 | ✅ 100% | 前端面板 + 智能体感知 + 工具操作 三线打通 |
| 会话管理 | ✅ 100% | CRUD + 历史 + 自动命名 + 压缩 |
| 文件浏览 | ✅ 100% | 树形浏览 + 内容预览 + 工作目录 |
| MCP 桥接 (pa-mcp) | ✅ 100% | 通用 MCP 客户端 + 自动工具注册 |
| Live2D 集成 | ❌ 已移除 | 独立 Electron 项目，MCP 协议接入 |
| 深色/浅色模式 | ❌ 0% | 未开始 |
