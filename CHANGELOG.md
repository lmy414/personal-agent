# Changelog

> git 追踪改动记录，本文件追踪改动意图。每条对应一个具体意图。

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
- **Commit**: （待提交）
