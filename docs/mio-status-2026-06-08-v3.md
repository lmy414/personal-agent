# 澪号 Personal Agent — 项目状态 v3

> 日期: 2026-06-08 | 上期: 2026-06-07 v2
> 状态: 设置页 5 个 Tab 全部接入真实数据，前端核心功能基本完成

---

## 一、整体架构

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     浏览器 (SolidJS + Tailwind + Vite)                       │
│                                                                               │
│  App.tsx — Registry 驱动布局 + 视图切换                                       │
│    ├─ MiniNav (52px) — 6 导航项 + 文件模式切换                                │
│    ├─ TopMenuBar — 全局菜单                                                   │
│    └─ activeView switch → 6 View                                              │
│                                                                               │
│  useAgent.tsx — 全局状态 Provider + Hook                                      │
│    WS + 会话 + 消息 + 智能体 + 设置 + 技能 + MCP + 工作目录 + 日志             │
│                                                                               │
│  shell/theme.ts — 5 主题 + 壁纸 + 响应式 accent                               │
│                                   │                                           │
│                                   │ ws://localhost:9229                       │
│                                   │ 46 client ↑  44 server ↓                 │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Bridge (Node.js + tsx --watch)                            │
│                                                                               │
│  index.ts — DB + 默认设置 + .pi 配置 + Agent 发现 + WSS + Watcher             │
│  protocol.ts — 46 client + 44 server 消息                                     │
│  dispatcher.ts — 45 路由                                                      │
│  handlers/ — 16 文件                                                          │
│  pi-session.ts — Pi SDK 会话管理                                              │
│  pi-adapter.ts — Pi 事件 → 协议消息翻译器                                     │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │ Pi SDK API
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Pi 扩展 (后端)                                            │
│  pa-mio   → 人格注入 v5 (4 层 Prompt)                                        │
│  pa-files → 文件浏览/预览                                                     │
│  pa-mcp   → MCP 桥接                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、协议消息统计 (90 条)

```
Client → Server (46 条)
  智能体管理 (6): agent.list / create / update / delete / switch / set_default
  会话管理 (7):   session.create / list / switch / delete / rename / history / state
  对话控制 (3):   agent.prompt / abort / compact
  配置控制 (4):   agent.model.set / agent.model.list / agent.thinking.set / agent.tools.set
  文件系统 (3):   file.list / read / write
  设置 (3):       settings.get / set / discover
  记忆 (2):       memory.search / list
  技能 (4):       skills.list / install / toggle / remove
  MCP (4):        mcp.list / save / toggle / remove
  工作目录 (5):   workdir.get / set + exclude.list / add / remove
  系统日志 (1):   system.logs
  厂商&模型 (3):  provider.save / delete + model.configure
  心跳 (1):       ping

Server → Client (44 条)
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
  MCP (2):        mcp.state / mcp.saved
  工作目录 (2):   workdir.state / exclude.state
  系统日志 (1):   system.logs
  厂商&模型 (3):  provider.saved / deleted / model.configured
  压缩 (1):       session.compacted
  系统 (1):       error
```

---

## 三、设置页实现状态

| Tab | 状态 | 接入方式 |
|-----|------|----------|
| 模型管理 | ✅ 完成 | provider.save/delete + model.configure + settings.discover |
| 显示设置 | ✅ 完成 | shell/theme.ts 5 主题 + 壁纸 + accent 响应式 |
| 技能管理 | ✅ 完成 | skills.list/install/toggle/remove + skills.state |
| 工作目录 | ✅ 完成 | workdir.get/set + exclude.list/add/remove |
| 系统信息 | ✅ 完成 | system.logs 动态加载 + 链接可点击 |

---

## 四、前端功能实现状态

### 已实现（接真实数据）— 12 个扩展/视图

| 模块 | 功能 |
|------|------|
| ChatRenderer | MomoTalk 布局、Avatar、Thinking 折叠、Markdown 渲染、流式渲染 |
| Sidebar | Agent 列表、会话搜索/切换/删除、工具日志、资源监控 |
| EditorPanel | 多文件 Tab、拖拽宽度、Markdown/HTML 预览 |
| FileTree | 目录树浏览、懒加载、文件拖拽、工作目录感知 |
| ToolPanel | 工具调用列表、展开详情、状态指示 |
| DocPreview | 文件内容预览 |
| RightPanel | Tab 切换、持久化内容 |
| MiniNav | 6 导航项、文件模式切换 |
| StatusBar | 时间、模型、Token、费用、上下文进度 |
| FileTreeView | 文件树全屏视图 |
| SettingsLayoutView | 5 Tab 全部接入真实数据 |
| TopMenuBar | 全局菜单 |

### Mock/硬编码 — 3 个视图

| View | 缺失 |
|------|------|
| CharacterView | 5 个 Agent 硬编码，未读 useAgent().agents() |
| SessionRecordsView | 会话列表/消息详情/工具日志全部硬编码 |
| CostDashboardView | 指标/图表/洞察全部硬编码 |

### 部分实现/有缺陷

| # | 问题 |
|---|------|
| P1 | chat-panel vs chat-renderer 重复 |
| P2 | EditorPanel 与 DocPreview 功能重叠 |
| P3 | 通用组件库几乎未被扩展使用 |
| P4 | 内联样式泛滥，难以主题化 |

---

## 五、后端 Handler 清单 (16 文件)

| Handler | 功能 |
|---------|------|
| settings.ts | 设置 CRUD + 模型发现 |
| file.ts | 文件列表/读取/写入 |
| session.ts | 会话 CRUD + 历史 + 压缩 |
| message.ts | 消息发送/取消 |
| model.ts | 模型切换/列表 |
| model-config.ts | 模型配置（思考强度/启停/可见性） |
| memory.ts | 记忆搜索/列表 |
| memory-store.ts | Bridge 侧记忆读写 |
| skills.ts | 技能 CRUD（安装/启停/删除） |
| agent.ts | 智能体管理 |
| thinking.ts | 思考深度配置 |
| tools.ts | 工具集配置 |
| provider.ts | 厂商 CRUD（API Key 注入） |
| mcp.ts | MCP 服务器配置 |
| workdir.ts | 工作目录 + 排除规则 |
| system-logs.ts | 系统日志（console 拦截 + 环形缓冲） |

---

## 六、待完成项

| 优先级 | 任务 |
|--------|------|
| P1 | CharacterView 接入 useAgent().agents() |
| P1 | SessionRecordsView 接入真实数据 |
| P1 | CostDashboardView 接入真实数据 |
| P2 | 通用组件库实际复用 |
| P2 | 内联样式 → CSS 模块化 |
| P3 | chat-panel / chat-renderer 去重 |

---

*本报告为项目状态基线文档，2026-06-08 生成。*
