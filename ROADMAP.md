# Personal Agent — 开发路线图

> 更新：2026-05-26 | 版本：v0.1.1 | 审计修复完成

---

## 当前状态

```
v0.1.1  |  18 commits  |  ~3,116 行源代码
```

- DeepSeek API 流式对话（V3 / R1），多会话管理，消息持久化
- 工作目录文件浏览 + Markdown/HTML 预览（多 Tab）
- Token 用量监控 + 成本统计 + 预算预警
- API Key safeStorage 加密存储
- 路径遍历防护 + CSP 强化 + sandbox 启用
- 文件拖拽引用（内容不入库，仅注入 API 请求）

---

## 路线 A — 增强 Agent 能力

`Phase 2 核心目标 · 高价值 · 2026-05 ～ 2026-06`

### A1 · MCP Web 桥接

> 为 DeepSeek 接入 WebSearch/WebFetch MCP 服务器，让 Agent 能搜索网络

**现状**：Claude Code 原生 WebSearch/WebFetch 仅对 Anthropic 官方模型可用。DeepSeek 等第三方模型需要 MCP 桥接层。

**方案**：集成 [CC-Web-MCP](https://github.com/JcDizzy/CC-Web-MCP) (`uvx cc-web-mcp`) 作为 fallback，提供 `web_search`、`fetch_url`、`research_brief` 三个工具。

**步骤**：
1. 调研 CC-Web-MCP 的 API 接口和启动方式
2. 在 `ipc-handlers.js` 中添加 MCP 客户端调用逻辑
3. 对话中让 Agent 判断何时需要搜索，自主调用工具
4. 搜索结果注入对话上下文

**涉及文件**：`src/main/api.js`（新增 MCP client）、`src/main/ipc-handlers.js`

**预估**：3-5 个 session

---

### A2 · Shell 命令执行

> Agent 可执行预定义安全命令（只读为主）

**安全边界**：
- 工作目录白名单限制（复用 Step 1 的 `isPathSafe`）
- 命令白名单：`dir`/`ls`、`cat`/`type`、`git log`/`git status`、`find`/`grep`
- 禁止：`rm`、`del`、`format`、`shutdown`、任何 `|` 管道或 `&&` 链式
- 输出长度截断（超过 2000 字符截断 + 提示）

**步骤**：
1. 定义命令白名单和参数校验规则
2. 添加 `shell:exec` IPC handler
3. 对话中 Agent 可请求执行命令，结果显示在消息气泡中

**涉及文件**：`src/main/ipc-handlers.js`、`preload.js`、`src/renderer/chat.js`

**预估**：2-3 个 session

---

### A3 · 工具调用可视化

> 对话中展示 Agent 正在用什么工具（搜索/读文件/执行命令）

**UI 设计**：
```
[Agent] 正在搜索: "DeepSeek API max_tokens"
        ↓ 搜索完成，找到 3 个结果
[Agent] 根据搜索结果，max_tokens 默认值为 4096...
```

**步骤**：
1. 定义工具调用状态事件（`tool:start` / `tool:end`）
2. 在消息流中插入工具调用指示器（加载动画 → 完成状态）
3. 支持的工具：WebSearch、WebFetch、Shell 命令、文件读取

**涉及文件**：`src/renderer/chat.js`、`src/renderer/style.css`、`preload.js`

**预估**：1-2 个 session

---

## 路线 B — 打磨现有体验

`低风险 · 修边角 · 穿插在路线 A 之间`

### B1 · 系统原生目录选择器

> 替换 `prompt()` 输入路径 → 系统 `dialog.showOpenDialog`

**当前问题**：切换工作目录时弹出文本输入框，体验差且容易输错。

**步骤**：
1. 已有 `dialog:openDirectory` IPC handler（Step 10 修复中添加）
2. 修改 `btn-select-dir` 直接调用系统对话框，去掉 `prompt()`

**涉及文件**：`src/renderer/app.js`

**预估**：0.5 个 session

---

### B2 · 会话右键菜单

> 侧边栏会话列表支持右键删除/重命名

**步骤**：
1. 在 `#conv-list` 上监听 `contextmenu` 事件
2. 弹出自定义上下文菜单（定位在鼠标位置）
3. 选项：重命名、删除（红色）、导出

**涉及文件**：`src/renderer/app.js`、`src/renderer/style.css`

**预估**：1 个 session

---

### B3 · 二进制文件识别

> 预览时检测二进制文件，显示文件信息而非乱码

**步骤**：
1. `fs:readFile` 返回时附带 `isBinary` 标志
2. 前端对二进制文件显示类型图标 + 文件大小 + "不支持预览"
3. 支持常见二进制格式识别：图片、PDF、压缩包、可执行文件

**涉及文件**：`src/main/ipc-handlers.js`、`src/renderer/app.js`

**预估**：0.5 个 session

---

### B4 · marked.js 替换手写 Markdown 渲染

> 用成熟库替换 `basicMarkdown()` 和 `renderMarkdownSafe()`

**步骤**：
1. `npm install marked`
2. 替换 `chat.js` 中 `basicMarkdown()` → `marked.parse()`
3. 替换 `app.js` 中 `renderMarkdownSafe()` → `marked.parse()`
4. 删除手写渲染器（约 100 行）
5. 验证：表格、任务列表、嵌套列表、HTML 实体

**涉及文件**：`src/renderer/chat.js`、`src/renderer/app.js`、`package.json`

**预估**：1 个 session

---

## 路线 C — 架构升级

`Phase 3 · 长期投资 · 2026-07 以后`

### C1 · 多模型提供商

> 抽象 API 层，支持 DeepSeek / OpenAI / Anthropic / Ollama 一键切换

**方案**：提取 `BaseProvider` 接口，每个提供商实现 `chat()` / `chatStream()` / `listModels()`。设置页新增提供商选择下拉。

**预估**：5-8 个 session

---

### C2 · 对话导出

> 单会话导出为 Markdown / PDF

**方案**：Markdown 导出直接拼接消息文本；PDF 导出通过 Electron `printToPDF`。支持"包含系统提示词"和"包含用量统计"选项。

**预估**：2-3 个 session

---

### C3 · 系统托盘 + 全局快捷键

> 最小化到托盘，全局热键唤起/隐藏

**步骤**：
1. 创建 Tray 图标 + 右键菜单（显示/退出）
2. 注册全局快捷键 `Ctrl+Shift+A` 唤起窗口
3. 关闭窗口时最小化到托盘而非退出

**涉及文件**：`main.js`

**预估**：1-2 个 session

---

## 推荐执行顺序

```
第 1 轮: B1 系统对话框 (0.5) → B3 二进制检测 (0.5) → B2 右键菜单 (1)
第 2 轮: A1 MCP Web 桥接 (3-5) → A3 工具可视化 (1-2)
第 3 轮: A2 Shell 命令 (2-3) → B4 marked.js (1)
第 4 轮: C3 系统托盘 (1-2) → C2 对话导出 (2-3)
第 5 轮: C1 多模型提供商 (5-8)
```

先做 B 类小优化热身，然后推进 A 类核心功能，逐步进入 C 类架构升级。
