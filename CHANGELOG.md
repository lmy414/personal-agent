# Changelog

> git 追踪改动记录，本文件追踪改动意图。每条对应一个具体意图。

---

## 2026-06-06

### 前端组件库提取 — 9 通用组件 + CSS 模块化

- **原因**: App.css 单文件 1251 行难以维护；各扩展内重复 UI 模式（按钮/开关/输入框/进度条等）无复用；组件代码与样式耦合。参照 uiverse-io/galaxy 平铺式组件库模式，建立前端组件化基础层。
- **改动**: 29 文件（18 新建，11 修改）
  - 新建 `frontend/src/components/` 下 9 个通用组件（GlassPanel、Spinner、ProgressBar、Badge、Toggle、IconButton、GlassInput、TabBar、DragHandle），每个自包含 `index.tsx` + `index.css`
  - 拆分 App.css 到 9 个扩展 CSS（chat-renderer、session-panel、tool-panel、status-bar、file-tree、doc-preview、right-panel、top-menu、settings-page）
  - App.css 1251 → 150 行（只保留 CSS 变量、reset、滚动条、Grid 布局、顶部菜单、设置页容器、多扩展共用动画）
  - App.tsx 内联 DragHandle 替换为组件（-23 行）
  - 9 个扩展 TSX 各添加对应 CSS import
- **影响**: 前端所有 UI 层，CSS 组织从单文件变为组件级文件，视觉效果零变更
- **验证**: `tsc --noEmit` 通过，`vite build` 成功（41 modules, CSS 30.58 KB, JS 99.84 KB）
- **Commit**: `11ea590`, `a4daa5b`, `cffee75`

---

## 2026-06-05

### 审计修复：P0/P1/P2 共 8 项

- **原因**: 全项目源码审计发现 3 处设计冲突（工作目录双根、slot 文档错误、设置项悬空）、4 项过期/未实现、5 项代码质量隐患。逐项修复 P0-P2。
- **改动**: 7 文件。
  - **P0**: pa-files fallback 从 `process.cwd()` 改为 `PROJECT_ROOT`（统一前后端根路径）；`/workspace` 命令改为写 SQLite（与设置页统一数据源）；状态文档 tool-panel slot 修正 + 架构图布局修正
  - **P1**: `history_retention` 消费——`handleSessionHistory` 读取设置限制返回消息数；`compact_threshold` 消费——`agent_end` 后检查使用率超阈值自动 compact；`npm test` 接入 `tests/run-all.ts`
  - **P2**: WebSocket 心跳——前端每 30s 发 ping 防静默断线；tool duration——记录 `tool_execution_start` 时间戳计算实际耗时；Bridge 优雅退出——SIGINT/SIGTERM 关闭 wss + db
- **影响**: pa-files 路径解析、会话历史加载、上下文压缩触发时机、测试入口、WS 连接稳定性、工具耗时展示、进程退出安全
- **验证**: `npm run check` 全过（仅 vendor/pi 上游错误）
- **Commit**: `2ef5e4a`

### 文档更新：移除 Live2D、新增工作目录、同步目录结构

- **原因**: Live2D 集成已从主应用移除（6 个 refactor 连续 commit），但 CLAUDE.md 和状态文档仍有大量 Live2D 引用。同时新增工作目录系统、pa-mcp、架构图等未在文档中反映。
- **改动**: 11 文件。
  - `CLAUDE.md`：移除 Live2D 启动步骤（终端 3）、架构章节（接入方式/通信架构/端口/工具）、`live2d-signal.ts` / `SceneLayer.tsx` / `chat-input` 等已删除文件；更新目录结构匹配实际 9 个前端扩展 + 7 handler + 6 层 Prompt
  - 新建 `docs/mio-status-2026-06-05.md`：最新项目状态（工作目录系统、Live2D 移除记录、完整进度表）
  - 新建 `docs/architecture.html`：vis-network 交互式架构图（6 色分组、tooltip、双击聚焦）
  - `docs/mio-status-2026-06-01.md`：标注已过期
  - 4 份 Live2D spec/plan：标注 ⚠️ 已废弃；2 份 Electron 迁移文档：标注 ✅ 已完成
  - `bridge/index.ts`：修复 `.pi/settings.json` 生成中残留的 `pa-live2d` → `pa-mcp`
- **影响**: 项目文档体系（CLAUDE.md、状态文档、spec/plan 历史记录）；首次安装默认配置生成
- **验证**: Grep 确认 CLAUDE.md Live2D 引用从 14 降至 2（仅在 packages/live2d-pet 独立项目说明中）
- **Commit**: `61e9403`

### 工作目录设置：文件面板 + 智能体感知 + 工具操作三线打通

- **原因**: 文件管理面板硬编码项目根目录，智能体无法感知用户自定义工作目录，导致路径分裂（前端看一处、LLM 工具看另一处）。
- **改动**: 6 文件。
  - `bridge/handlers/file.ts`：`resolveSafe` 新增绝对路径分支（`isAbsolute` → `existsSync` → 放行）
  - `frontend/.../SettingsPage.tsx`：新增"工作目录"输入框，`onBlur`/`Enter` 提交
  - `frontend/.../FileTree.tsx`：读取 `work_dir` 设置 → 订阅 `settings.state` → 自动切换根目录 + 刷新
  - `extensions/pa-files/index.ts`：`getWorkspaceRoot()` 动态读 SQLite，工具操作指向正确目录
  - `extensions/pa-mio/index.ts`：Layer 2.5 `<recall>` 围栏注入工作目录描述 → 智能体感知
  - `.gitignore`：新增 `.codegraph/`
- **影响**: 文件浏览、LLM 工具调用（`list_directory`/`preview_file`）、system prompt 上下文
- **验证**: `npm run check` 全过；设置页输入路径 → 文件面板自动切换；智能体回复确认工作目录
- **Commit**: `4f49282`

---

## 2026-06-03

### 技术债务清理：12 项遗留问题修复

- **原因**: 项目扫描发现 12 项技术债务——P0 check 失败阻塞提交，P1 死代码/过时文件占用，P2 维护负担（gitignore 漏洞/测试文件错位/嵌套仓库异常），P3 文档不一致/代码质量。
- **改动**: 15 文件。
  - **P0**: 创建 `bridge/scripts/check.mjs` 过滤 vendor/pi 类型错误，`npm run check` 恢复通过
  - **P1**: 删除 `bridge/handlers/index.ts`（死文件）、`frontend/src/extensions/chat-input/`（死组件）、`bridge/.pi/extensions/`（过时副本，已分化 52 行）
  - **P2**: `.gitignore` 加入 Vite 时间戳文件、`test-context-stats.ts` 迁至 `tests/`、物理删除 `D:claude​live2d-mcp` 嵌套 git 仓库
  - **P3**: 路由数量文档修正（18→19）、`top-menu`/`settings-page` index.ts 移除死注册改为纯 export、`live2d-view` 注释修正、App.tsx 残留"记 忆 检 索"改为"文件"、bridge 移除 7 条 debug console.log
- **影响**: 桥接检查流程、前端扩展注册模式、文档准确性、磁盘文件清理
- **验证**: `npm run check` 通过；git status 干净（仅预期改动）
- **Commit**: `7a1e9fb`

### 文档维护：全量审查 + 修正过期内容

- **原因**: 项目文档多处与实际代码不符——EchoBot 已移除但多处引用、记忆快照改为实时但未更新、表情数量不准确、文档计数过时。
- **改动**: `README.md`（移除 EchoBot 启动步骤、记忆改为实时快照、表情 5→3、CHANGELOG 入文档列表、specs 7→8、plans 6→7）；`docs/mio-status-2026-06-02.md`（移除 EchoBot 外部依赖、记忆快照描述修正、Live2D 表情数修正、watcher 排除 frontend 标记完成、MCP 进度 50→70%、git log 更新至 2026-06-03、文件树新增 godot-migration、specs/plans 计数修正）；`frontend-sketch/API.md`（顶部添加过时警告，指向实际协议定义）。
- **影响**: README.md、docs/mio-status-2026-06-02.md、frontend-sketch/API.md
- **验证**: 逐项对比代码实际状态确认。
- **Commit**: `2b133c3`

---

## 2026-06-03

### 代码审计：消除硬编码路径 + 模型匹配修复 + 扩展加载修复

- **原因**: 项目代码扫描发现 18 个问题，其中 3 层叠加导致"AI 不回复"：① 默认模型名 `deepseek-chat` 不在 Pi SDK 注册表中 → fallback 到 Claude；② `.pi/settings.json` 不在 git 中 → pa-mio 等人格扩展不加载；③ 文件监听器广播 Vite HMR 变化 → WebSocket 连接风暴；④ 4 处 `D:/claude/` 硬编码路径 → 换机器无法启动。
- **改动**: 14 个文件。默认模型改为 `deepseek-v4-pro`，bridge 启动时自动生成 `.pi/settings.json`，watcher 忽略 `frontend/` `.claude/` `vendor/`，3 处路径改为 `__dirname` 推导，1 处改为 `process.cwd()`，`generateUUID()` fallback 兼容 Node <19，`INSERT OR REPLACE` 替代 DELETE+INSERT，SQLite 中旧模型名修复，Live2D Scene1 注册到 model3.json，清理死 import 和错误注释，`package.json` test script 改为占位。
- **影响**: bridge（路径解析、模型选择、扩展加载、DB 操作、UUID 生成）；extensions（pa-mio 人格注入、pa-files 文件浏览）；frontend（Live2D 动作、入口 import、slot 布局）；mcp-servers（Live2D 工具定义）。
- **验证**: TypeScript 检查通过（vendor/pi 预存错误除外）；DeepSeek API 端到端测试通过；bridge 启动日志确认扩展加载 + 模型为 `deepseek-v4-pro`；前端 WS 连接正常。
- **Commit**: `025f8e6`

### 项目规则更新：Git 提交 + CHANGELOG 机制

- **原因**: 建立"每次改动确认通过后立即提交 + 写入 CHANGELOG"的纪律，git 追踪 what，CHANGELOG 追踪 why。
- **改动**: `CLAUDE.md` Git 规则章节新增"提交规则"和 CHANGELOG 条目格式模板；新会话接续清单增加 `读 CHANGELOG.md`；本文件创建。
- **影响**: CLAUDE.md、CHANGELOG.md
- **验证**: 规则文件内容审阅通过。
- **Commit**: `c42541f`
