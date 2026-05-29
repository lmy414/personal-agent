# Personal Agent — 设计文档

> v0.5.3 · Pi 架构 + 澪号 Harness + 流水线透视 · 2026-05-29

## 1. 概述

Personal Agent 是一个基于 Pi 编码 Agent 框架的个人 AI 助手。核心理念：**魔改 Pi**——保持 Pi 的极简核心，用扩展系统承载所有差异化功能。

## 2. 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| Agent 框架 | **Pi (pi-mono)** | MIT 开源，双层 Agent 循环，28 事件扩展系统，300+ 模型支持 |
| LLM | **DeepSeek V3 + R1** | 成本极低（V3: $0.27/M input），OpenAI 兼容协议，中文优秀 |
| Web UI | **wgnr-pi (fork)** | 原生 JS 零框架，WebSocket 实时流式，极易魔改，fork 在 vendor/ |
| 持久化 | **SQLite (better-sqlite3)** | 结构化查询，跨会话分析，零配置 |
| 通信 | **Pi RPC + WebSocket** | Pi RPC 模式驱动 Agent，WebSocket 推送流式响应到浏览器 |
| 扩展 | **Pi Extension API** | 28 个生命周期事件，registerTool/registerCommand/registerProvider |

### 为什么不用 Electron

- 自研 GUI 维护成本高（~2300 行前端代码）
- 需要从零实现 Agent 循环、工具系统、模型抽象
- Pi 已经提供了所有这些基础设施

### 为什么选 wgnr-pi 而不是自研 Web UI

- 原生 JS 零框架，一个 HTML 文件 1392 行
- 已实现会话管理、模型选择、思考级别、斜杠命令、图片支持
- 修改成本极低（已全部汉化）
- Fork 在 `vendor/wgnr-pi/`，patch 永久可追溯

## 3. 架构

```
┌─────────────────────────────────────────┐
│            浏览器 (wgnr-pi)               │
│  侧边栏 │ 对话区 │ 输入框 │ 模型选择       │
│         WebSocket ↑↓                     │
├─────────────────────────────────────────┤
│          wgnr-pi (Express)               │
│  spawn Pi RPC ←→ WebSocket 消息转发       │
├─────────────────────────────────────────┤
│            Pi Agent Core                 │
│  agent-loop (双层 while)                  │
│  4 内置工具: read / write / edit / bash   │
├─────────────────────────────────────────┤
│          Personal Agent Extensions       │
│  pa-sqlite │ pa-usage │ pa-files │ pa-budget │ pa-mio │ pa-observe │
├─────────────────────────────────────────┤
│            Pi AI (pi-ai)                 │
│  OpenAI 兼容协议 → DeepSeek API           │
└─────────────────────────────────────────┘
```

## 4. 扩展设计

每个扩展是一个 TypeScript 文件，通过 `export default function(pi: ExtensionAPI)` 注册。

### pa-sqlite（~158 行）

| 钩子 | 用途 |
|------|------|
| `session_start` | 创建/更新 SQLite 会话记录 |
| `message_end` | 持久化每条消息（role, content, tokens, model） |
| `session_shutdown` | 关闭数据库连接 |

### pa-usage（~135 行）

| 钩子 | 用途 |
|------|------|
| `message_end` | 从 assistant 消息提取 usage.input / usage.output |
| 命令 | `/usage [today|month|14d]` `/cost` |

### pa-files（~176 行）

| 注册 | 类型 |
|------|------|
| `list_directory` | LLM 工具 — TypeBox schema 校验参数 |
| `preview_file` | LLM 工具 — 路径安全校验 + 文件预览 |
| `/files` `/preview` `/workspace` | 用户命令 |

### pa-budget（~104 行）

| 钩子 | 用途 |
|------|------|
| `turn_start` | 检查当日/当月用量，>=80% 黄色警告，>=100% 红色错误 |
| 命令 | `/budget` `/budget set <月> <日>` |

### pa-observe（~316 行）— v0.4.0 新增，v0.5.2 修复

| 钩子 | 用途 |
|------|------|
| `session_start` | 捕获 `sessionFile` / `sessionId`，写入 trace 用于跨会话过滤 |
| `before_agent_start` | 记录组装后的 systemPrompt |
| `context` | 记录 LLM 调用前的消息数组 |
| `before_provider_request` | 捕获完整 HTTP 请求体（JSON） |
| `after_provider_response` | 捕获 HTTP 状态码 |
| `tool_execution_start` | 记录工具名、开始时间 |
| `tool_execution_end` | 记录返回值、计算耗时 |
| `message_end` | 提取 assistant 回复，跑 5 项计数器 |
| `agent_end` | 组装 trace JSON，写入文件 |

## 5. 数据流

```
用户输入 → WebSocket → wgnr-pi → Pi RPC stdin
                                    ↓
                              agent-loop
                              ↓           ↓
                           LLM 调用    工具执行
                              ↓           ↓
                           DeepSeek    read/edit/write/bash
                              ↓
Pi RPC stdout → wgnr-pi → WebSocket → 浏览器实时渲染
                              ↓
                         扩展事件钩子
                              ↓
                    pa-sqlite 写 SQLite
                    pa-usage 记录用量
                    pa-budget 检查预算
```

## 5. 澪号 Harness 设计

### pa-mio（~263 行）

澪号 Harness 扩展。核心机制：9-Slot Prompt 注入 + 5 计数器反馈校验 + JSON 记忆系统。

**Prompt 注入顺序**（9 个 Slot）：
| Slot | 内容 | 来源 | 性质 |
|------|------|------|------|
| 0 | 元指令（身份 > 工具） | `meta_instruction.txt` | 静态 |
| 1 | 身份层（soul + boundaries） | `soul.md` + `boundaries.md` | 静态 |
| 2 | 知识层 | `knowledge.md` | 静态 |
| 3 | 运行环境（Pi 原生提示词 + 工具定义） | Pi 注入 | 动态 |
| 4 | 记忆层 | `mio_memories.json` 检索 | 按需 |
| 5 | Chat History | Pi 管理 | 动态 |
| 6 | 语言锚（~50 tokens） | 硬编码 | 静态（最靠近输出） |
| 7 | 修正槽 | 计数器触发时注入 | 按需 |
| 8 | 用户消息 | 用户输入 | 动态 |

**5 个计数器**（字符级，不跑 LLM）：
| # | 检测项 | 规则 | 修正指令 |
|---|--------|------|---------|
| 1 | 叠甲 | ≥2 个叠甲词 | 不叠甲，有观点直接说 |
| 2 | emoji 溢出 | ≥3 个 emoji | 不使用 emoji |
| 3 | 感叹号溢出 | ≥2 个！ | 不用感叹号 |
| 4 | 话痨 | >200 字 | 短句 |
| 5 | 亲密溢出 | <10 轮出现 hhh/嗯嗯/摸摸 | 不够熟，克制 |

**记忆系统**：
- 存储：`~/.personal-agent/mio_memories.json`（JSON 数组，最多 500 条）
- 检索：CJK 2-4 字关键词 → 包含匹配 → 衰减权重 `importance × e^(-0.05×天数)` → top 5
- 提取：对话 >10 条后，独立 DeepSeek 调用提取 → 写入 JSON

### 关键设计决策

- Pi 原生 systemPrompt 退化为 Slot 3 内的 `[运行环境]` 标签，不与澪号身份竞争权重
- Slot 0-3 形成静态前缀（~2100 tokens），可被 Prompt Cache 命中
- Slot 6 语言锚在 Chat History 之后、用户消息之前——注意力权重最高
- 长工具返回（>500字）时自动在 history 前额外插入语言锚，对抗稀释

## 6. 流水线透视（pa-observe）

### 设计目标

将 Agent 内部黑盒操作可视化——用户能看到每轮对话中系统执行了什么、API 发了什么、工具调了什么、计数器有没有触发。

### 架构

```
pa-observe (Pi 扩展, ~230 行)
  ├── before_agent_start  → 捕获组装后的 systemPrompt
  ├── context             → 捕获消息列表
  ├── before_provider_request → 捕获 HTTP 请求体 (DeepSeek API)
  ├── after_provider_response → 捕获 HTTP 状态码
  ├── tool_execution_start/end → 记录工具名、参数、耗时
  ├── message_end         → 提取 assistant 回复，跑 5 项计数器
  └── agent_end           → 组装 trace JSON → 写入文件
                              ↓
              ~/.personal-agent/observe_last_trace.json
                              ↓
           wgnr-pi GET /api/observe_trace → 前端 fetch (3s 轮询)
                              ↓
                      renderTrace() → DOM 渲染
```

### 数据传递方案（v0.5.2 更新）

选择文件 + HTTP 轮询而非 WebSocket 推送，原因：
- Pi 的 `api.sendMessage()` 自定义消息经过 RPC 序列化后，`details` 字段可能丢失或格式变化
- 文件写入 + HTTP 端点更可靠，前端控制拉取节奏
- wgnr-pi server.js 只需加一个 ~10 行的 Express 路由

**Session 匹配机制**（v0.5.2）：
- pa-observe 将 `sessionId`（ULID）写入 trace JSON，API 使用 `sessionId` 查询
- server 端 `cwdKey` 使用 `replace(/[/\:*?"<>|]/g, "-")` 兼容 Windows 路径
- server 端 `homedir()` 替代 `process.env.HOME`，跨平台可靠
- 前端 `groupByDate()` 添加 `isNaN` 防御，防止无效时间戳导致会话不可见

### 前端面板

- `position: fixed` 脱离文档流，不影响聊天区布局
- `transform: translateX` 实现滑入/滑出动画
- 面板宽度 420px，移动端 360px
- 每个步骤折叠显示标题行（图标 + 标题 + 徽章 + 箭头），展开显示描述 + 指标 + 详细内容
- 使用字符串拼接而非模板字面量，避免内联 HTML 中的转义问题

## 7. 配色

沿用原 Personal Agent 配色：

| 颜色 | 色值 | 用途 |
|------|------|------|
| 背景 | `#1a1a2e` | 主背景 |
| 表面 | `#16213e` | 侧边栏、消息气泡 |
| 用户气泡 | `#1e3a5f` | 用户消息 |
| 强调色 | `#6EA8DB` | 按钮、链接、选中态 |
| 金色 | `#D4AF37` | AI 标签、工具调用 |
| 文字 | `#e0e0e0` | 正文 |
| 次级文字 | `#8892a4` | 时间戳、辅助信息 |

---

## 8. 架构债务与改进方向（v0.6.0 规划）

> 以下改进点来源于 2026-05-29 全项目代码审计（`docs/audit-report-2026-05-29.md`）和扩展架构调研（`docs/EXTENSION-HANDBOOK.md`）。

### 8.1 扩展架构：从隐式耦合到显式契约

#### 问题：数据库 Schema 隐式契约

当前 `pa-sqlite`、`pa-usage`、`pa-budget` 形成强隐式耦合：

- `pa-sqlite` 在 `session_start` 中创建 `messages`、`conversations`、`usage_log` 表
- `pa-usage` 直接向 `usage_log` 写入数据
- `pa-budget` 从 `usage_log` 读取数据计算成本

**风险**：若 `pa-sqlite` 加载失败或被移除，`pa-usage` 和 `pa-budget` 会静默失败；若 schema 变更，下游扩展无版本感知。

**改进方向**：
1. **Schema 版本化**：每张共享表增加 `_schema_version` 字段或元数据表
2. **自包含建表**：`pa-usage` 和 `pa-budget` 在 `session_start` 中用 `CREATE TABLE IF NOT EXISTS` 声明自己依赖的表，不假设 `pa-sqlite` 已执行
3. **表名前缀自治**：所有扩展的数据库表使用 `pa_<name>_*` 前缀，明确归属

#### 问题：pa-observe 内嵌 pa-mio 的计数器逻辑

`pa-observe/index.ts` 第 19–57 行复制了 `pa-mio` 的 `runCounters()` / `checkResponse()` 逻辑，违反 DRY 原则。修改计数规则需要改两处，易遗漏。

**改进方向**：
1. **共享计数器引擎**：将计数器逻辑从 `pa-mio` 抽离到 `extensions/shared/counter-engine.ts`
2. **pa-mio 和 pa-observe 统一导入**：`pa-mio` 使用引擎做注入修正，`pa-observe` 使用同一引擎做观测记录
3. **配置驱动**：计数规则从硬编码改为 JSON 配置，扩展只读不写

#### 问题：pa-observe 硬编码 pa-mio 的实现细节

`pa-observe` 的 subtitle 中出现 `"9 个 Slot 按序注入——元指令 → 身份层..."`，一个通用观察扩展不应知晓特定角色（澪号）的 prompt 结构。

**改进方向**：
- `pa-observe` 只记录原始 systemPrompt 字符串，不做语义解析
- 若需要展示结构化信息，由 `pa-mio` 通过 `details` 字段或独立文件输出元数据

### 8.2 扩展与宿主边界：降低 wgnr-pi 耦合

#### 问题：扩展向前端推送数据必须修改 server.js

当前 `pa-observe` 通过写入文件 + `vendor/wgnr-pi/server.js` 新增 `/api/observe_trace` 端点实现面板数据传递。每新增一个需要面板的扩展，都要改 wgnr-pi。

**改进方向**：
1. **扩展内嵌 HTTP 子服务器**：扩展在独立端口起 Express/Koa 服务（如 `pa-observe` 起 `localhost:4816`），wgnr-pi 只负责 iframe 或反向代理
2. **WebSocket 广播通道**：Pi 宿主提供 `api.broadcast(channel, payload)` API，wgnr-pi 作为 WebSocket 代理统一转发，扩展不直接操作 server.js
3. **文件契约 + 自动路由发现**：wgnr-pi 扫描 `~/.personal-agent/` 下的 `.trace.json` 文件，自动暴露同名 REST 端点，扩展只需写文件

### 8.3 systemPrompt 链式拼接的不可预测性

多个扩展监听 `before_agent_start` 并返回 `{ systemPrompt }`，宿主按加载顺序链式拼接。`pa-mio` 可能覆盖/拼接 `pa-observe` 的内容，顺序依赖导致行为不可预测。

**改进方向**：
1. **Slot 化 systemPrompt**：宿主将 systemPrompt 划分为 `header`、`identity`、`tools`、`footer` 等 Slot，扩展声明自己要修改的 Slot，而非返回完整字符串
2. **优先级权重**：扩展注册时声明 `priority: number`，高优先级扩展后执行，避免顺序依赖
3. **显式合并策略**：提供 `append`（追加）、`prepend`（前置）、`replace`（替换）三种模式，默认 `append`

### 8.4 进程模型：消除孤儿进程与 EPIPE

#### 问题：shell: true + SIGTERM 导致孤儿进程

`main.js` 和 `vendor/wgnr-pi/server.js` 均使用 `spawn(..., { shell: true })`。在 Windows 上：
- `SIGTERM` 只会终止 `cmd.exe`，子进程（pi-node / wgnr-pi）被孤儿化
- 路径中的特殊字符经过 `cmd.exe` 解析，存在命令注入风险

**改进方向**：
1. 两处 `spawn` 均改为 `shell: false`
2. Windows 下使用 `taskkill /PID <pid> /T /F` 级联终止整个进程树
3. `main.js` 的 `stdio` 使用独立流，避免双写同一 `fs.WriteStream` 导致 EPIPE

#### 问题：全局 wgnr-pi 与本地 vendor 的运行时漂移

崩溃日志显示实际运行的是全局 npm 目录的 `wgnr-pi`，而非本地 `vendor/wgnr-pi/`。本地 patch 不生效。

**改进方向**：
1. `main.js` 启动前校验实际加载的 `server.js` 绝对路径，与本地 vendor 路径比对
2. 若检测到全局实例，强制终止并报警
3. 长期：本地 vendor 使用独立端口（如 4816），避免与全局实例冲突

### 8.5 配置层：从绝对路径到相对路径

#### 问题：settings.json 全量硬编码绝对路径

`.pi/settings.json` 中所有扩展和技能路径写死为 `D:/claude/personal-agent/...`，项目移动后全部失效。

**改进方向**：
1. settings.json 使用相对路径（如 `"extensions/pa-sqlite/index.ts"`）
2. 加载器基于 `settings.json` 所在目录 `path.resolve()` 为绝对路径
3. 校验解析后的路径必须在项目根目录内，防止 `../../../` 遍历

#### 问题：package.json 缺少 Electron 依赖

项目依赖全局安装的 Electron，版本不可控，其他机器 `npm install` 后无法运行。

**改进方向**：
- 根 `package.json` 添加 `"devDependencies": { "electron": "^33.0.0" }`
- `pa.bat` 改为 `"%~dp0"` 相对路径，并检查 `electron` 是否在 PATH 中

### 8.6 安全设计：路径与 SQL 的底线

#### 问题：多处路径遍历

- `pa-observe` 的 `traceKey()` 直接使用 `sessionId` 作为文件名
- `pa-files` 的 `resolveSafe()` 使用 `startsWith` 在 Windows 上大小写敏感
- `vendor/wgnr-pi/server.js` 的 Session API 和 `observe_trace` API 可被 `../` 绕过

**改进方向**：
1. 所有用户输入的路径参数使用 `path.resolve()` + 大小写不敏感的 `startsWith` 校验
2. `sessionId` 等标识符作为文件名前先做 `sha256` 哈希
3. REST API 的 ID 参数使用 `^[a-zA-Z0-9_-]+$` 白名单

#### 问题：SQL 注入

- `pa-usage/index.ts` 的 `getStats()` 将 `period` 直接拼接到 SQL
- `mio-harness/memory.py` 使用 f-string 拼接 `LIKE` 子句

**改进方向**：
1. TypeScript 扩展：全部使用参数化查询或分支查询（`if (period === 'today') ...`）
2. Python 模块：`sqlite3` 使用 `?` 占位符，禁止 f-string 拼接 SQL

### 8.7 扩展生命周期：缺少 unload hook

当前扩展工厂函数被调用一次即完成初始化，没有 `deactivate` / `unload` 钩子。宿主热重载或退出时，扩展的数据库连接、定时器、文件句柄可能泄漏。

**改进方向**：
1. 扩展工厂函数返回 `dispose` 函数：`export default function (pi) { ...; return { dispose() { db.close(); } }; }`
2. 宿主在扩展卸载前调用 `extension.dispose()`
3. 当前过渡方案：所有扩展在 `session_shutdown` 中清理资源，模块级状态重置

### 8.8 共享层：稳定契约与版本控制

#### 问题：shared/ 模块缺少版本和向后兼容保障

`extensions/shared/db-config.ts`、`logger.ts`、`counters.ts` 被多个扩展导入，但无版本号。若修改 `getPricing()` 的返回值结构，所有调用方可能静默失败。

**改进方向**：
1. `shared/` 目录增加 `VERSION` 常量，扩展加载时校验
2. 导出函数保持向后兼容：新增参数用可选参数或 options 对象，不删除旧函数
3. 关键函数（如 `getPricing`）返回值使用明确接口而非 `any`

### 8.9 数据持久化：从共享文件到扩展自治

#### 问题：多个扩展读写同一 JSON 文件

`pa-mio` 和 `pa-observe` 都可能访问 `~/.personal-agent/` 下的文件，没有锁机制或原子写入。

**改进方向**：
1. 每个扩展的数据存放在专属子目录：`~/.personal-agent/pa-<name>/`
2. 写文件使用原子写入：`writeFileSync(tmp)` → `renameSync(tmp, target)`
3. 共享状态通过 SQLite 事务管理，避免 JSON 文件的并发覆盖

---

## 9. 演进路线图

| 版本 | 目标 | 关键改动 |
|------|------|----------|
| v0.5.4 | 安全加固 | 修复路径遍历、SQL 注入、`shell: true`、EPIPE 崩溃 |
| v0.5.5 | 配置治理 | settings.json 相对路径、package.json 补全 Electron、pa.bat 相对路径 |
| v0.6.0 | 架构解耦 | shared counter-engine、扩展表名前缀自治、systemPrompt Slot 化、pa-observe 去 mio 化 |
| v0.6.5 | 进程治理 | 移除全局 wgnr-pi 依赖、本地 vendor 独立端口、孤儿进程清零 |
| v0.7.0 | 扩展生态 | 扩展 unload hook、api.broadcast 前端通道、扩展市场清单格式 |

---

## 10. 参考文档

| 文档 | 内容 |
|------|------|
| `docs/audit-report-2026-05-29.md` | 全项目代码审计报告，含 11 项严重、20 项中危、15 项轻微问题及修复代码 |
| `docs/EXTENSION-HANDBOOK.md` | 扩展开发手册，含最小模板、接口速查、解耦通信模式、新增 checklist |
| `docs/SESSION-STATE.md` | 会话状态管理设计 |
| `docs/ROADMAP.md` | 功能路线图 |
