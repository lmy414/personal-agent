# 澪号 Personal Agent

基于 Pi + DeepSeek 的个人 AI 助手。前端 SolidJS + Tailwind，后端 Node 桥接 Pi SDK。

## 快速启动

```bash
# 终端 1 — 桥接服务器（支持热重载）
cd bridge && npm run dev

# 终端 2 — 前端 dev
cd frontend && npm run dev
```

浏览器打开 `http://localhost:5173`。

---

## 目录结构

```
personal-agent/
├── CLAUDE.md                 ← 本文件（每次新会话先读这个）
├── README.md                  ← 项目介绍
├── .gitignore                 ← node_modules, dist, .env, *.db
├── package.json               ← monorepo root（concurrently 双启动）
├── bridge/                    ← Node 桥接服务器（Pi SDK → WebSocket）
│   ├── .pi/settings.json      ←   Pi 扩展注册（3 个扩展，绝对路径）
│   ├── index.ts               ←   入口：WS Server + SQLite + Live2D 中继
│   ├── protocol.ts            ←   消息类型定义（前后端共享，~130 行）
│   ├── dispatcher.ts          ←   消息路由表（18 路由）
│   ├── pi-session.ts          ←   Pi 会话管理 + 模型注册表
│   ├── db.ts                  ←   SQLite 持久化（~/.personal-agent/agent.db）
│   ├── watcher.ts             ←   文件监听 + 广播
│   └── handlers/              ←   按消息类型拆文件（7 文件，9 handler）
├── frontend/                  ← SolidJS 前端
│   ├── src/
│   │   ├── shell/             ←   壳（Grid 布局 + WS hook + 全局信号）
│   │   │   ├── App.tsx        ←     壳组件 + 面板拖拽
│   │   │   ├── App.css        ←     玻璃拟态 UI 全样式
│   │   │   ├── useAgent.tsx   ←     全局状态 + WebSocket 管理
│   │   │   ├── live2d-signal.ts ←   Live2D 面板参数信号
│   │   │   ├── settings-signal.ts ← 设置页面开关信号
│   │   │   └── SceneLayer.tsx ←     Live2D 场景层
│   │   ├── registry.ts        ←   扩展注册表（Slot-based 插件系统）
│   │   └── extensions/        ←   11 个扩展组件，每个一个文件夹
│   │       ├── chat-input/    ←     对话输入框
│   │       ├── chat-renderer/ ←     消息气泡渲染 + 思考折叠
│   │       ├── session-panel/ ←     会话列表 + 切换
│   │       ├── file-tree/     ←     文件树浏览
│   │       ├── tool-panel/    ←     工具调用状态
│   │       ├── doc-preview/   ←     文档内容预览
│   │       ├── top-menu/      ←     顶部菜单栏
│   │       ├── settings-page/ ←     全屏设置覆盖层
│   │       ├── status-bar/    ←     状态栏
│   │       ├── right-panel/   ←     右侧面板 Tab
│   │       └── live2d-view/   ←     悬浮 Live2D 看板
│   ├── index.html
│   ├── tailwind.config.ts
│   └── vite.config.ts
├── extensions/                ← Pi 扩展（由 bridge/.pi/settings.json 注册）
│   ├── pa-mio/index.ts        ←   人格注入 v4（5 层 Prompt + 意图分类 + 记忆工具）
│   ├── pa-files/index.ts      ←   文件浏览/预览工具
│   ├── pa-live2d/index.ts     ←   Live2D 表情/动作/状态工具（WebSocket 中继）
│   └── shared/memory-store.ts ←   记忆读写核心（§ 文件操作 + 原子写入）
├── mcp-servers/live2d/        ← MCP Server（独立进程）
│   ├── index.ts               ←   JSON-RPC over STDIO
│   ├── test.ts                ←   协议测试
│   └── package.json
├── mio-harness/               ← 角色数据
│   ├── SOUL.md                ←   人格定义（行为规则，~800 chars）
│   └── memories/              ←   持久记忆（§ 分隔 Markdown）
│       ├── MEMORY.md          ←     环境/项目记忆（≤2200 chars，6 条 §）
│       └── USER.md            ←     用户画像（≤1375 chars，17 条 §）
├── mio-data/                  ← 澪号角色设计资料
├── frontend-sketch/           ← UI 原型（设计源，9 个 HTML 原型）
├── docs/
│   ├── mio-status-2026-06-02.md ← 最新项目状态
│   └── superpowers/
│       ├── specs/             ←   设计 Specs（7 份）
│       └── plans/             ←   实现计划（6 份）
└── vendor/pi/                 ← Pi 框架（不修改）
```

---

## 代码规范

### TypeScript

- 严格模式 `"strict": true`
- 不用 `any`（除非桥接 Pi 的类型缺口）
- 导出的函数/类型必须有显式返回类型

### 格式

```
缩进: 2 空格
引号: 单引号
分号: 不加
行宽: 100 字符
尾逗号: 加（ES5）
```

### 命名

| 对象 | 规则 | 示例 |
|------|------|------|
| 文件 | kebab-case | `chat-renderer.tsx`, `use-agent.ts` |
| SolidJS 组件 | PascalCase | `ChatPanel`, `ToolEntry` |
| 函数/变量 | camelCase | `sendMessage`, `sessionId` |
| 类型/接口 | PascalCase | `MessagePayload`, `Extension` |
| 常量 | UPPER_SNAKE | `MAX_RECONNECT_DELAY` |
| 事件 handler | `handle` 前缀 | `handleSend`, `handleToolClick` |

### 导入顺序

```
1. 外部库          import { createSignal } from 'solid-js'
2. shell/共享      import { useAgent } from '@/shell/use-agent'
3. 同扩展内        import { formatCost } from './utils'
4. CSS             import './chat-panel.css'
```

组间空一行。

### SolidJS 组件模板

```tsx
// 简单组件用 function 声明
export function ToolEntry(props: ToolEntryProps) {
  const [expanded, setExpanded] = createSignal(false)

  return (
    <div class="tool-entry" classList={{ running: props.status === 'running' }}>
      ...
    </div>
  )
}
```

- Props 类型在组件上方定义
- 不用 default export（统一 named export）
- Tailwind class 超过 5 个时换行，每个 class 一行

---

## 扩展规范

### 前端扩展

每个扩展是 `extensions/<name>/` 下的文件夹，最少两个文件：

```
extensions/my-feature/
├── index.ts          ← 注册入口
└── MyFeature.tsx     ← 组件
```

`index.ts` 模板：

```ts
import { registry } from '@/shell/registry'
import { MyFeature } from './MyFeature'

registry.register({
  id: 'my-feature',
  slot: 'right',                   // left-top | left-middle | left-bottom | center | right
  label: '功能名',                   // 右侧面板标签显示名（slot=right 时需要）
  component: MyFeature,
})
```

规则：
- 每个扩展自己管理状态（`createSignal`/`createStore`），不直接改其他扩展的状态
- 通过 `useAgent()` hook 读全局数据（消息列表、会话状态、WebSocket 实例）
- 扩展之间不互相 import
- 删掉文件夹 = 完全移除功能，不影响任何其他代码

### 桥接 handler

`bridge/handlers/<domain>.ts`，导出同名函数：

```ts
import type { ClientMessage } from '../protocol'

export async function handleMessageSend(msg: ClientMessage, ws: WebSocket): Promise<void> {
  // 处理逻辑
}
```

然后在 `dispatcher.ts` 路由表注册一行。

---

## Git 规则

### 分支

```
main              ← 可运行的主线
feat/<name>       ← 新功能
fix/<name>        ← bug 修复
```

### Commit

```
<type>: <描述>

type: feat / fix / refactor / style / docs / chore
描述用中文，简短（<50 字符）
```

示例：
```
feat: 前端扩展注册机制
fix: 工具面板展开后宽度不跟随
refactor: protocol.ts 拆分为独立文件
```

### 提交规则

1. **每次改动确认通过后立即提交** — 不攒多个改动一起交。
2. 提交信息（commit message）记录 **改了什么**（what）。
3. 同步写入 `CHANGELOG.md`，记录 **为什么要改 + 影响范围**（why + impact）。
4. git 追踪改动记录，CHANGELOG 追踪改动意图。每条记录对应一个具体意图。

CHANGELOG 条目格式：
```markdown
## YYYY-MM-DD

### <意图摘要>
- **原因**: <为什么改，问题根因>
- **改动**: <改了什么文件/逻辑>
- **影响**: <影响范围>
- **验证**: <如何确认通过>
- **Commit**: <commit-hash>
```

### 提交前检查

- [ ] `npm run check` 通过（TypeScript + lint）
- [ ] 前端 dev server 无报错
- [ ] 原型文件（`frontend-sketch/`）的改动已同步到实际组件
- [ ] CHANGELOG.md 已更新

### 不提交

- `node_modules/`、`dist/`
- `.env`、包含 API key 的文件
- `*.db`、`*.sqlite`
- `vendor/pi/` 下的任何改动（除非刻意升级 Pi 版本）

---

## 查错流程

出问题时按这个顺序排查：

```
1. 桥接服务器终端        ← 先看这里：Pi 事件日志、handler 报错
2. 浏览器 DevTools       ← Console 面板看 WS 消息、Network 看 WS 连接状态
3. 前端组件              ← React DevTools 扩展看 SolidJS 状态
4. DeepSeek API         ← 桥接日志里的 API 请求/响应
```

**常见问题速查**：

| 现象 | 可能原因 | 查什么 |
|------|---------|--------|
| 前端连不上 | 桥接没启动 | `ws://localhost:9229` 是否 listen |
| 消息发不出去 | WS 断连 | 浏览器 Console 有无 WS error |
| AI 不回复 | API key 失效 | 桥接日志里的 DeepSeek 响应状态 |
| 扩展没显示 | 没注册 | `registry.ts` 是否有该扩展的 register 调用 |
| 面板重叠 | Grid 参数不对 | 检查 shell/App.tsx 的 grid-template |

---

## 新会话接续

新 AI 会话（Claude/Gemini 等）进入项目时，按顺序：

```
1. 读本文件（CLAUDE.md）
2. 读 CHANGELOG.md 了解最近改动及意图
3. 读 C:\Users\Mirror\.claude\projects\D--claude\memory\MEMORY.md 了解进行中的任务（auto-memory）
4. 读 docs/mio-status-2026-06-02.md 了解当前项目状态
5. 读 docs/superpowers/specs/ 下最新 spec
6. 读 frontend-sketch/layout-mockup-v2.html 了解 UI 原型
7. git log --oneline -20 了解最近改动
8. npm run check 确认项目当前状态
```

**修改代码前**：
- 先在 `frontend-sketch/` 的原型上验证 UI 改动
- 新增扩展按"扩展规范"模板创建
- 修改协议先改 `protocol.ts`，再同步前后端

**修改完成后**：
- 更新相关 spec 文档
- 提交 commit

---

## 人格与记忆系统

### 人格注入（pa-mio）

澪号的人格通过 **SOUL.md**（`mio-harness/SOUL.md`）定义。单个文件，行为规则，<1KB。

每次 LLM 调用时，pa-mio 组装 5 层 System Prompt：

```
Layer 0: SOUL.md                        ← 人格定义，绝对顶部（实时读取，改文件立即生效）
Layer 1: 记忆快照（MEMORY.md + USER.md） ← 会话启动冻结，<recall> 围栏
Layer 2: 注入上下文（检索记忆 + 工具结果）← 每轮动态
Layer 3: Pi 工具定义                     ← Pi 自动注入（含 memory_add/read, live2d_expression 等）
Layer 4: 模式指令（chat/agent）          ← 18 条正则意图分类，chat 免工具 / agent 可调工具
Layer 5: 对话历史                        ← Pi 管理
```

- **SOUL.md**：实时读取，改文件立即生效
- **记忆快照**：会话启动冻结，中途写入不更新快照（保护 prefix cache），下次会话可见
- **工具隔离**：`<recall>` 围栏包裹记忆，防止被当作指令
- **思考分离**：`thinking_delta` 与 `text_delta` 分开处理，前端默认折叠

### 记忆系统（Hermes 风格）

```
mio-harness/memories/
├── MEMORY.md    ← § 分隔条目，≤2200 chars，环境/项目记忆
└── USER.md      ← § 分隔条目，≤1375 chars，用户画像
```

- **条目格式**：`§ 声明式事实`（不是命令式指令）
- **写入**：LLM 调用 `memory_add` 工具 → 原子写入磁盘（tempfile + fsync + rename）
- **读取**：LLM 调用 `memory_read` 工具
- **检索**：关键词匹配 § 条目
- **安全**：写入前扫描 prompt injection 模式

### 热重载

改 bridge 自身代码 → `tsx watch` 自动重启。

改前端代码 → Vite HMR。

改扩展/角色文件（`extensions/` 或 `mio-harness/`）→ 需手动重启 bridge。

改前端 Live2D 组件（`frontend/src/extensions/live2d-view/`）→ Vite HMR 自动生效。

改 Live2D 模型文件 / Cubism SDK → 需通过 EchoBot (localhost:8000) 提供，无需重启。

## 硬约束

- **不修改 `vendor/pi/`**——Pi 是上游依赖，改动会在升级时丢失
- **不跳过 TypeScript 检查**——`strict: true`，不用 `as any` 绕
- **不在组件里直接操作 DOM**——用 SolidJS 响应式，除非 WebSocket 回调
- **扩展不互相依赖**——每个扩展是独立文件夹，import 范围不超出自身
- **前端不直接调 Pi SDK**——所有 Pi 交互通过桥接服务器 WebSocket
- **原型文件是设计源**——UI 改动先在 `layout-mockup-v2.html` 验证，再写到组件
