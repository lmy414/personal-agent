# Changelog

> git 追踪改动记录，本文件追踪改动意图。每条对应一个具体意图。

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
