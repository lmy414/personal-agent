# Personal Agent — 项目总览

> 个人 AI 助手桌面应用。资料收集、文章撰写、信息查询、文件管理。
> 构建日期：2026-05-25 | 总代码量：~2,800 行 | 版本 v0.1.0

---

## 一、当前状态

### 已实现功能

| 模块 | 功能 | 状态 |
|------|------|------|
| **对话** | DeepSeek API 流式对话（V3 / R1） | ✅ |
| **对话** | 多会话管理（新建/切换/自动命名） | ✅ |
| **对话** | 消息持久化（SQLite） | ✅ |
| **对话** | System Prompt 可配置 | ✅ |
| **对话** | Temperature / MaxTokens 可调 | ✅ |
| **对话** | 清空上下文 | ✅ |
| **工作目录** | 本地文件系统浏览（真实目录树） | ✅ |
| **工作目录** | 文件夹展开/折叠 | ✅ |
| **工作目录** | 自定义工作路径 | ✅ |
| **文件预览** | 右侧面板展开（可拖拽调整宽度） | ✅ |
| **文件预览** | Markdown 渲染 + 源码双视图切换 | ✅ |
| **文件预览** | HTML iframe 网页渲染 + 源码双视图 | ✅ |
| **文件预览** | 多 Tab 管理 | ✅ |
| **用量监控** | Token 消耗统计（今日/本月/14天） | ✅ |
| **用量监控** | 成本计算（USD/CNY，DeepSeek 费率） | ✅ |
| **用量监控** | 柱状图 + 每日明细表 | ✅ |
| **用量监控** | 预算预警（月度/单日上限） | ✅ |
| **设置** | API Key / Base URL 配置 | ✅ |
| **设置** | Agent 参数（Temperature/MaxSteps/ContextLimit） | ✅ |
| **设置** | 模型列表从 API 动态获取 | ✅ |
| **设置** | 连接测试 | ✅ |
| **设置** | 配置持久化（SQLite） | ✅ |
| **UI** | Chatbox 风格三栏布局 + 右侧预览面板 | ✅ |
| **UI** | 深青配色（#8DF0F7 / #336466 / #FFCFC2 / #82D6D9 / #D1D1D1） | ✅ |

### 技术架构

```
┌─────────────────────────────────────────────────┐
│                RENDERER (前端)                    │
│  index.html  ←  style.css                       │
│  app.js     ←   chat.js  ←  settings.js         │
│  全局状态 / 对话逻辑 / 文件树 / 设置面板 / 用量面板  │
├─────────────────────────────────────────────────┤
│              PRELOAD (桥接层)                     │
│  preload.js — contextBridge.exposeInMainWorld   │
│  15 个 IPC channel，纯数据通信                    │
├─────────────────────────────────────────────────┤
│             MAIN PROCESS (后端)                   │
│  main.js          ← Electron 入口               │
│  api.js           ← DeepSeek API (stream/non)   │
│  db.js            ← SQLite (better-sqlite3)     │
│  usage.js         ← Token 统计 + 成本计算        │
│  ipc-handlers.js  ← 14 个 IPC handler           │
├─────────────────────────────────────────────────┤
│             DATA LAYER                           │
│  SQLite (conversations / messages / usage_log /  │
│         settings)  +  本地文件系统 (工作目录)       │
└─────────────────────────────────────────────────┘
```

### IPC 接口清单

| Channel | 方向 | 用途 |
|---------|------|------|
| `settings:get` | Renderer → Main | 读取所有设置 |
| `settings:save` | Renderer → Main | 保存设置 |
| `api:test` | Renderer → Main | 测试 API 连接 |
| `models:list` | Renderer → Main | 从 API 获取可用模型 |
| `conversations:list` | Renderer → Main | 获取会话列表 |
| `conversations:create` | Renderer → Main | 创建新会话 |
| `conversations:delete` | Renderer → Main | 删除会话 |
| `conversations:rename` | Renderer → Main | 重命名会话 |
| `conversations:getMessages` | Renderer → Main | 获取会话消息 |
| `chat:send` | Renderer → Main | 发送消息（核心） |
| `usage:stats` | Renderer → Main | 获取用量统计 |
| `usage:pricing` | Renderer → Main | 获取模型费率 |
| `fs:listDir` | Renderer → Main | 列出目录 |
| `fs:readFile` | Renderer → Main | 读取文件内容 |
| `chat:token` | Main → Renderer | 流式推送 Token |
| `usage:updated` | Main → Renderer | 用量更新通知 |

### 数据库表结构

- **conversations** — id, title, created_at, updated_at
- **messages** — id, conversation_id, role, content, tokens_input, tokens_output, model
- **usage_log** — id, date, model, tokens_input, tokens_output, request_count
- **settings** — key, value

### 启动方式

```bash
cd D:\claude\personal-agent
npm start
```

前置条件：全局安装 Electron 37.x，配置 DeepSeek API Key。

---

## 二、设计理念

### 核心原则

1. **前后端完全分离** — Renderer 零 Node.js 权限（`nodeIntegration: false, contextIsolation: true`），所有后端调用通过 preload bridge
2. **本地优先** — 所有数据存 SQLite，API Key 不出本地，不依赖云端服务（除了 LLM API 调用本身）
3. **渐进增强** — Phase 1 先完成对话 + 用量监控，后续逐步加 RAG/工具链/多 Agent
4. **Chatbox 风格 UI** — 熟悉的 IM 布局降低使用门槛，右侧预览面板实现"边聊边看"

### 为什么选 Electron 而不是 Tauri

- 用户已有全局 Electron 37.x + @electron/packager
- 生态系统最成熟（better-sqlite3 等原生模块支持完善）
- HTML/CSS/JS 技术栈改动灵活
- 后期可平滑迁移 Tauri（前端代码复用）

### 为什么选 DeepSeek 而不是 Anthropic

- 成本极低（V3: $0.27/M input，仅为 Claude Sonnet 的 9%）
- OpenAI 兼容 API 格式，迁移成本低
- 中文能力优秀，适合用户场景

---

## 三、后续路线图

### Phase 2 — Agent 能力（短期）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| **文件拖拽引用** | 从文件树拖文件到对话，附带文件内容到上下文 | 🔴 高 |
| **Web Search 工具** | Agent 可主动搜索网络获取最新信息 | 🔴 高 |
| **知识库 / RAG** | 工作目录文件向量化，语义检索后注入对话 | 🟡 中 |
| **简单 Shell 命令** | Agent 可执行预定义的安全命令 | 🟡 中 |
| **工具调用可视化** | 对话中展示 Agent 正在用什么工具 | 🟡 中 |
| **Markdown 库集成** | 用 marked.js 替换手写解析器 | 🟢 低 |

### Phase 3 — 增强体验（中期）

| 功能 | 说明 |
|------|------|
| **多模型切换** | 同时支持 DeepSeek / OpenAI / Anthropic / 本地 Ollama |
| **BYOAI 架构** | 抽象模型层，切换提供商零代码改动 |
| **Prompt 模板** | 预设场景模板（写文章/翻译/代码审查/数据分析） |
| **导出对话** | Markdown / PDF 导出 |
| **系统托盘** | 最小化到托盘，全局快捷键唤起 |
| **对话搜索** | 全文搜索历史对话 |
| **浅色主题** | 跟随系统 / 手动切换 |

### Phase 4 — 知识引擎（长期）

| 功能 | 说明 |
|------|------|
| **本地 RAG 引擎** | 文档解析 → 分块 → Embedding → 向量检索 → 增强回答 |
| **混合检索** | 向量相似度 + BM25 关键词 + 文件路径导航 |
| **多格式解析** | PDF / Word / Excel / 图片 OCR |
| **知识图谱** | 自动提取实体关系，构建个人知识网络 |
| **Git 版本记忆** | 文件级版本追溯，Agent 操作可审计可回滚 |
| **离线本地模型** | Ollama + Qwen/Llama 本地推理，完全断网可用 |
| **Agent 工具链** | MCP 协议接入，Agent ↔ 工具标准化 |

---

## 四、设计参考与灵感

### 同类产品参考

| 产品 | 借鉴点 |
|------|--------|
| **Chatbox** | 侧边栏 + 对话区 + 输入栏三栏布局 |
| **Claude Code** | Agent 循环 + 工具调用 + 文件操作 |
| **Cherry Studio** | 多模型切换 + Prompt 模板管理 |
| **Dify** | 可视化知识库 + RAG Pipeline |

### 架构参考

| 来源 | 核心思想 |
|------|----------|
| Google Agent Bake-Off 2026 | 拆解单体 Agent → 专业子 Agent 团队；LLM 推理，确定性代码执行 |
| Anthropic MCP 协议 | Agent ↔ 工具标准化连接（类比 USB-C / HTTP） |
| Skywork Personal AI Workers 2026 | 六层 Agent 栈：控制面/认知/工具/数据/策略/设备 |
| Cabinet (GitHub Apr 2026) | 文件系统优先，Markdown 即数据库，Git 版本记忆 |
| Knowhere (GitHub May 2026) | 无 Embedding RAG，Agent 导航文档结构 |
| SitePoint Agentic Patterns 2026 | 六大设计模式：Reflection / Tool Use / Planning / Multi-Agent / Orchestrator-Worker / Evaluator-Optimizer |

### 技术决策参考

- **分层记忆架构**：即时记忆（上下文窗口）→ 工作记忆（SQLite 会话）→ 长期记忆（向量库 + 知识图谱）
- **混合模型策略**：日常用 DeepSeek-V3（便宜），复杂推理用 R1，未来加本地模型做简单分类
- **穷尽评估**：2026 行业共识——评估体系比模型选择更重要。Phase 2 需要加入 LLM-as-Judge 评测

---

## 五、文件清单

```
personal-agent/
├── PROJECT.md               ← 本文件（项目总览）
├── DESIGN.md                ← 原始设计规划
├── package.json             ← 依赖配置
├── main.js                  ← Electron 主进程（43 行）
├── preload.js               ← IPC 桥接层（45 行）
├── preview.html             ← 主界面原型（参考）
├── preview-settings.html    ← 设置页原型（参考）
├── src/
│   ├── main/                ← 后端代码
│   │   ├── api.js           ← DeepSeek API 客户端（200 行）
│   │   ├── db.js            ← SQLite 数据库（86 行）
│   │   ├── usage.js         ← 用量统计（102 行）
│   │   └── ipc-handlers.js  ← IPC 处理器（278 行）
│   └── renderer/            ← 前端代码
│       ├── index.html       ← 主界面结构（151 行）
│       ├── style.css        ← 样式（515 行）
│       ├── app.js           ← 应用编排 + 文件树 + 预览（726 行）
│       ├── chat.js          ← 对话逻辑 + 流式渲染（218 行）
│       └── settings.js      ← 设置面板 + 用量仪表盘（447 行）
└── data/                    ← 运行时数据（自动生成）
```

---

## 六、下次继续时

### 立即可以做的

1. 填入 DeepSeek API Key → 开始对话
2. 切到工作目录 Tab → 浏览 `D:\claude` → 点文件预览
3. 设置 → 用量管理 → 查看成本统计

### 第一个要修的

> **文件拖拽引用功能** —— 从文件树拖文件到输入框，自动附带文件内容到对话上下文。这是连接"文件浏览"和"对话"两个模块的关键功能。

### 代码入口

- **main.js** → Electron 启动 → `init()` DB → `registerHandlers()` → `createWindow()`
- **app.js** → `init()` 加载设置 → 加载会话 → 加载模型 → 监听流式事件
- **chat.js** → `Chat.sendMessage()` → build messages from DOM → IPC `chat:send` → handle stream
- **settings.js** → `Settings.open()` → 注入 HTML → 填充表单 → 事件代理

### 调试技巧

- 所有 IPC 调用都有明确的 channel 名称，可在 `preload.js` 查看完整 API 列表
- 后端日志在 Electron 控制台（启动时的终端）
- 前端日志在 Renderer DevTools（`Ctrl+Shift+I`）
- SQLite 数据库位置：`%APPDATA%/personal-agent/agent.db`
