# 澪号 Personal Agent 项目状态

> 日期: 2026-06-01

---

## 一、架构总览

```
浏览器 (SolidJS + PIXI/Cubism)
    ↕ WebSocket (ws://localhost:9229)
桥接服务器 (Node.js + Pi Agent SDK)
    ↕ HTTP
DeepSeek API
    ↕ STDIO (JSON-RPC)
MCP Server (Live2D 表情/动作控制)
```

**外部依赖**: EchoBot (localhost:8000)，提供 Cubism SDK 文件 + Live2D 模型 API

---

## 二、已完成系统

### 2.1 人格系统 (pa-mio v4)

| 文件 | 说明 |
|------|------|
| `mio-harness/SOUL.md` | 人格定义，行为规则，~300 字符 |
| `extensions/pa-mio/index.ts` | 4 层 Prompt 组装 + chat/agent 双模式 |

**4 层 Prompt 结构**:
```
Layer 0: SOUL.md                       ← 人格（绝对顶部）
Layer 1: 记忆快照（MEMORY.md + USER.md） ← <recall> 围栏
Layer 2: 注入上下文（检索记忆）           ← 每轮动态
Layer 3: Pi 工具定义                    ← Pi 注入
Layer 4: 模式指令（chat/agent）          ← 正则分类，动态
```

**意图分类**: 18 条中文正则 → chat/agent 路由
- chat: "轻量闲聊，不需要调用工具"
- agent: "可以调用工具，完成后汇报结果"

**思考分离**: `thinking_delta` 和 `text_delta` 分开处理，前端默认折叠

### 2.2 记忆系统 (Hermes 风格)

| 文件 | 说明 |
|------|------|
| `mio-harness/memories/MEMORY.md` | 环境/项目记忆，§ 分隔，≤2200 chars |
| `mio-harness/memories/USER.md` | 用户画像，§ 分隔，≤1375 chars |
| `extensions/shared/memory-store.ts` | 记忆读写核心（原子写入+安全扫描+冻结快照） |

**LLM 工具**:
- `memory_add(target, content)` — 写入记忆
- `memory_read(target)` — 读取记忆

**关键设计**: 冻结快照（保护 prefix cache），写入立即持久化但下次会话才可见

### 2.3 设置系统

| 功能 | 状态 |
|------|------|
| 模型厂商接入 | DeepSeek + Anthropic |
| 模型管理/切换 | 设置页面完成 |
| 默认模型/参数 | SQLite 持久化 |
| 上下文压缩阈值 | 可配置 |

### 2.4 Live2D 基础验证

| 成果 | 说明 |
|------|------|
| 模型文件 | 卡拉 (16 个内置表情 + 1 个动作) |
| 独立测试页 | `live2d-test-v2.html` — SDK 加载+模型渲染+表情切换 全通过 |
| 自定义表情 | smile/bigsmile/sad 等 5 个参数直驱表情 |
| MCP Server | `mcp-servers/live2d/` — JSON-RPC 协议，测试通过 |

### 2.5 基础设施

| 功能 | 说明 |
|------|------|
| Bridge 热重载 | `tsx watch` 自动重启 bridge 自身代码 |
| 前端热重载 | Vite HMR |
| 扩展注册 | `bridge/.pi/settings.json` 注册 pa-mio + pa-files |
| Git | 已连接 GitHub，推送正常 |

---

## 三、待完成

### 3.1 前端 Live2D 悬浮组件（阻塞中）

**问题**: SolidJS 组件环境下 Canvas/PIXI 不显示模型，但独立 HTML 页正常
**文件**: `frontend/src/extensions/live2d-view/Live2DView.tsx`
**下一步**: 排查 canvas 初始化时机 / PIXI ticker / SolidJS 生命周期

### 3.2 MCP → Bridge → 浏览器 链路

- Bridge `live2d.control`/`live2d.result` 中继已写 ✅
- MCP Server `sendToBrowser` 通过 Bridge WS ✅
- 端到端未联调 ❌

### 3.3 Pi mcporter 配置

- MCP Server 已用 STDIO 通信 ✅
- Pi 需配置 mcporter 启动 MCP Server 子进程 ❌
- LLM 通过 `tools/call` 调 `live2d_expression` 未联调 ❌

### 3.4 表情自动匹配（未开始）

当前 LLM 需要手动调用 `live2d_expression` 工具。理想情况：LLM 回复时根据语气自动匹配表情。

---

## 四、关键文件索引

```
mio-harness/
├── SOUL.md                           ← 人格
└── memories/
    ├── MEMORY.md                     ← 环境记忆
    └── USER.md                       ← 用户画像

extensions/
├── pa-mio/index.ts                   ← 人格注入 + 意图分类 + 记忆工具
├── pa-files/index.ts                 ← 文件浏览工具
└── shared/memory-store.ts            ← 记忆读写

mcp-servers/live2d/
├── index.ts                          ← MCP Server (JSON-RPC over STDIO)
├── test.ts                           ← 协议测试
└── package.json

bridge/
├── index.ts                          ← 入口 + Live2D 中继
├── protocol.ts                       ← 消息类型
├── dispatcher.ts                     ← 路由
├── watcher.ts                        ← 文件监听 + broadcastToAll
└── handlers/
    ├── memory.ts                     ← 记忆查询
    └── memory-store.ts              ← bridge 侧记忆读写

frontend/src/
├── extensions/
│   └── live2d-view/                  ← 悬浮 Live2D (进行中)
│       ├── index.ts
│       └── Live2DView.tsx
└── shell/
    ├── useAgent.tsx                  ← 全局状态 + WS
    └── App.tsx

frontend-sketch/
├── layout-mockup-v2.html            ← 主界面原型（已集成悬浮面板）
├── live2d-standalone-test.html      ← 独立 Live2D 测试
├── live2d-test-v2.html              ← 参数表情测试
└── live-mode-prototype-v2.html      ← LIVE 模式原型

docs/
├── superpowers/
│   ├── specs/2026-06-01-mio-persona-memory-refactor.md
│   └── plans/
│       ├── 2026-06-01-mio-persona-memory-refactor.md
│       └── 2026-06-01-live2d-integration.md
└── mio-status-2026-06-01.md         ← 本文档
```

---

## 五、运行方式

```bash
# 终端 1 — 桥接服务器 (端口 9229)
cd personal-agent/bridge && npm run dev

# 终端 2 — 前端 (端口 5173)
cd personal-agent/frontend && npm run dev

# 终端 3 — EchoBot (端口 8000, Live2D SDK + 模型)
cd bot/EchoBot && python -m echobot app

# MCP Server 测试 (STDIO)
cd personal-agent/mcp-servers/live2d && npx tsx test.ts
```
