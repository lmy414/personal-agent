# Personal Agent — 路线图

> v0.5.2 · 流水线透视已部署 + Windows 兼容性修复 · 2026-05-29

## 已完成

- [x] **Pi 环境** — DeepSeek V3 + R1 双模型接入，models.json 配置
- [x] **pa-sqlite** — 会话持久化到 SQLite，`session_start` / `message_end` / `session_shutdown` 事件钩子
- [x] **pa-usage** — Token 用量追踪 + 成本计算，`/usage` `/cost` 命令
- [x] **pa-files** — 工作区文件浏览器，LLM 工具 `list_directory` `preview_file`，`/files` `/preview` `/workspace` 命令
- [x] **pa-budget** — 预算预警，`turn_start` 钩子检查，`/budget` 命令
- [x] **Web UI** — wgnr-pi 接入，全中文界面
- [x] **一键启动** — pa.bat（打开浏览器 + 启动服务）
- [x] **pa-mio** — 澪号 Harness 扩展（~260 行），9-Slot Prompt 注入 + 5 计数器 + 记忆系统
- [x] **wgnr-pi 修复** — 工具调用块历史渲染 + 目录列表双换行修复
- [x] **pa-observe** — 流水线透视扩展（~316 行），7 步全链路追踪 + 右侧 Debug 面板 UI
- [x] **pa-observe BUG 修复** — session 切换绑定 + 跨会话数据污染 + 竞态守卫（v0.4.1）

## 近期规划

### Harness 迭代

- [ ] 计数器自动重试闭环（触发 → 修正槽注入 → 重新生成，最多 3 次）
- [ ] 长时间运行验证（记忆膨胀、角色漂移、token 成本）
- [ ] LLM-as-Judge 深度审计（计数器 3 次失败后触发）

### Web UI 改造

- [ ] 侧边栏文件树组件（替代 `/files` 命令）
- [ ] 用量仪表盘面板（可视化替代 `/usage` `/cost`）
- [ ] 会话搜索
- [ ] 自定义 System Prompt 编辑
- [ ] 深色/浅色主题切换

### Agent 能力

- [ ] MCP Web 桥接（为 DeepSeek 接入 WebSearch/WebFetch）
- [ ] Shell 命令执行（安全白名单）
- [ ] 工具调用可视化（对话中显示 Agent 正在用什么工具）
- [ ] 会话自动命名（首条消息做标题）
- [ ] Markdown 源码/渲染切换

### 存储 & 数据

- [ ] 旧 Electron 数据迁移脚本（`%APPDATA%/personal-agent/agent.db` → `~/.personal-agent/agent.db`）
- [ ] 用量统计前端图表（替代终端文本表格）
- [ ] 对话全文搜索（SQLite FTS5）
- [ ] 对话导出（Markdown / JSON）
- [ ] 记忆检索升级（JSON → SQLite / Vector）

## 中期规划

- [ ] 多模型提供商支持（OpenAI / Anthropic / Ollama）
- [ ] RAG 知识库（工作目录文件向量化）
- [ ] 系统托盘 + 全局快捷键
- [ ] 对话分支管理可视化
- [ ] 提示词模板库
- [ ] 图片输入支持（粘贴 / 拖拽 / 附件）
- [ ] wgnr-pi 角色选择面板
- [ ] 澪号外观设计落实（立绘/Live2D）

## 长期方向

- [ ] 多 Agent 协作
- [ ] 本地模型（Ollama + Qwen）
- [ ] 跨设备同步（SQLite 备份到云端）
- [ ] 移动端适配（PWA）
- [ ] 插件市场（社区扩展）
