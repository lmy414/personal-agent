# wgnr-pi UI 层级拆解

> 文件：`vendor/wgnr-pi/public/index.html`（~1746 行，单文件 HTML+CSS+JS）  
> 目标：为彻底重构提供层级化拆解

## 1. 当前现状

- **单文件应用**：HTML 结构 + 511 行 CSS + ~1200 行 JS 全部内联
- **零框架**：原生 JS，无 React/Vue/Svelte，无构建流程
- **命令式 DOM**：全局 DOM 引用 + `innerHTML` 拼接，无虚拟 DOM
- **外部依赖**：`marked.js`（Markdown）、`DOMPurify`（XSS 过滤）

## 2. DOM 层级树

```
body
├── #header                          ← 顶部状态栏
│   ├── #header-left                 ← ☰ 汉堡按钮 + π logo + 状态点
│   ├── #header-center               ← 模型标签 + 思考级别标签
│   └── #toolbar                     ← 清空/帮助/导出/中止
├── .modal-backdrop                  ← 弹窗遮罩（帮助/模型选择）
├── #body-wrap                       ← 主体 Flex 容器
│   ├── #sidebar                     ← 左侧会话列表（256px）
│   │   ├── #btn-new-chat
│   │   ├── #session-list            ← 按日期分组（今天/昨天/本周…）
│   │   ├── #archived-toggle         ← 归档折叠开关
│   │   └── #archived-list
│   └── #content                     ← 右侧聊天主区域
│       ├── #pi-health-banner        ← Pi 断开提示条
│       ├── #messages                ← 消息滚动容器
│       ├── #stats-bar               ← Token / 成本统计条
│       └── #input-area              ← 底部输入区
│           ├── #image-previews      ← 图片缩略图行
│           └── #input-wrap          ← textarea + 命令补全 + 发送按钮
├── #panel-toggle                    ← 右侧 "🔍 流水线" 竖排按钮
└── #debug-panel                     ← 流水线透视面板（fixed, 420px）
```

## 3. CSS 层级

| 层级 | 范围 | 说明 |
|------|------|------|
| 变量层 | `:root` | 11 个 CSS 变量（颜色/圆角/宽度） |
| 基础层 | `*` / `html` / `body` | Box-sizing、Flex 布局、隐藏滚动条 |
| Header | `#header-*` | 三栏分布、状态点脉冲动画 |
| Modal | `.modal-backdrop` / `.modal-box` | 通用遮罩 + 内容区，`.open` 控制显示 |
| Sidebar | `#sidebar` / `#session-list` | 固定 256px、自定义滚动条、移动端 `translateX` |
| Messages | `.msg` / `.msg-body` | 四种消息类型 + Markdown 渲染样式 |
| Input | `#input` / `#cmd-palette` | textarea 自适应、命令浮层 |
| Panel | `#debug-panel` / `.trace-step` | fixed 右侧面板、折叠卡片、六色状态图标 |
| 动画 | `@keyframes` | pulse（呼吸）、fadein（消息出现）、spin（loading） |
| 响应式 | `@media` | 768px（移动端侧边栏）、900px（面板缩窄） |

## 4. JS 功能模块拆解

### 4.1 工具层
- `md(text)` — marked.parse + DOMPurify.sanitize
- `esc(s)` — HTML 实体转义

### 4.2 消息渲染
- `addMsg()` / `addUserMsg()` / `ensureAssistantMsg()` / `ensureThinking()`
- `scrollBottom()` — rAF 滚动到底部

### 4.3 会话管理（最复杂模块之一）
- `loadSessions()` — REST API + localStorage 缓存合并去重
- `groupByDate()` — 今天/昨天/本周/本月/更早分组
- `renderSessionList()` — 字符串拼接 HTML + 内联事件绑定
- `switchSession()` / `doArchiveSession()` / `doDeleteSession()`
- `openSessionMenu()` — fixed 定位下拉菜单（重命名/归档/删除）

### 4.4 WebSocket 核心
- `connect()` — 建立 WS，重连逻辑
- `handleEvent(data)` — **巨型分发器（~250 行 switch）**，处理 20+ 种消息类型：
  - `status` / `pi_health` / `error`
  - `commands` / `available_models`
  - `session_state` / `session_switched` / `session_reset`
  - `history` / `agent_start` / `agent_end`
  - `message_start` / `message_update` / `message_end`
  - `tool_execution_start` / `tool_execution_end`
  - `export_response`

### 4.5 交互模块
- `sendPrompt()` — 校验 + 拼接图片 + WS 发送
- `updateCmdPalette()` / `renderCmdPalette()` — 斜杠命令自动补全
- `handleFiles()` / `addImagePreview()` — 图片粘贴/选择/预览
- `toggleSidebar()` / `applySidebarState()` — 侧边栏开关
- `openModelPicker()` / `filterModels()` — 模型选择弹窗
- `updateStats()` — Token/成本统计条
- `togglePanel()` / `fetchObserveTrace()` / `renderTrace()` — 流水线面板（`renderTrace` ~180 行字符串拼接）

### 4.6 全局状态变量
```js
ws, reconnectTimer          // WebSocket
streaming                   // 是否流式输出中
currentAssistantEl          // 当前助手消息 DOM 引用
currentThinkingEl           // 当前思考中 DOM 引用
currentToolCalls = {}       // 工具调用 DOM 映射
allCommands, filteredCmds   // 斜杠命令缓存
currentSessionFile/Id       // 当前会话
sidebarOpen                 // 侧边栏状态
mode                        // 当前模式（"pi"）
currentModel/ThinkingLevel  // 模型配置
allModels                   // 可用模型列表
pendingImages = []          // 待发送图片
observePollTimer            // 流水线轮询定时器
```

## 5. 数据流

```
用户输入 / 点击 / 快捷键
    ↓
事件处理器（直接操作 DOM + 修改全局变量）
    ↓
WebSocket send / REST API fetch
    ↓
后端处理 → WS onmessage → handleEvent() 巨型 switch
    ↓
直接 DOM 操作（innerHTML / appendChild / classList）
    ↓
localStorage.setItem（session_state 等关键节点）
```

**核心问题**：状态与视图紧耦合，无中间层。流式消息通过全局 DOM 引用直接 patch。

---

**重构建议** → `UI-REFACTOR.md`
