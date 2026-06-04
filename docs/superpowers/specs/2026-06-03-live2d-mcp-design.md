> **⚠️ 已废弃** — Live2D 集成已从主应用移除（2026-06-05）。详见 status doc。
> 此文档保留为历史参考。

# Live2D MCP — 通用化独立组件 设计 Spec

> 日期: 2026-06-03 | 状态: design-approved

## 目标

将 Live2D 模块从 personal-agent 项目中抽离为**独立的 CLI 工具**，以标准 MCP 协议接入 Claude Desktop、OpenClaw 等主流智能体应用。用户可指定任意 Live2D 模型。

## 核心约束

- **发布形态**：npm 全局 CLI — `npm i -g live2d-mcp` → `live2d-mcp start`
- **协议**：纯 MCP（JSON-RPC 2.0 over STDIO），不做 HTTP API
- **模型**：用户通过配置指定 `.model3.json` 路径，工具不内置模型文件
- **内部通道**：保留 localhost-only WebSocket 供渲染器连接（Phase 1 兼容现有浏览器渲染，Phase 2 对接桌面窗口）
- **表情发现**：读模型文件自动提取表情列表，不硬编码
- **渲染**：Phase 1 不包含，通过内部 WS 广播指令给外部渲染器

## 架构

```
┌──────────────────────────────────────────┐
│          live2d-mcp (单进程)              │
│                                          │
│  ┌────────────┐  ┌────────────────────┐  │
│  │ MCP/STDIO  │  │  Internal WS       │  │
│  │ (stdin/out)│  │  ws://127.0.0.1:9228│ │
│  └─────┬──────┘  └───────┬────────────┘  │
│        │                 │               │
│  ┌─────┴─────────────────┴─────────────┐ │
│  │        Tool Dispatcher              │ │
│  │  5 tools: expression / motion /     │ │
│  │  status / parameter / animate      │ │
│  └────────────────┬────────────────────┘ │
│                   │                      │
│  ┌────────────────┴────────────────────┐ │
│  │      Model Reader                   │ │
│  │  读取 model3.json → 表情/动作列表    │ │
│  └────────────────┬────────────────────┘ │
│                   │                      │
│  ┌────────────────┴────────────────────┐ │
│  │   Config (~/.live2d-mcp/)           │ │
│  └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
     │                           │
     ▼                           ▼
 Claude Desktop            浏览器 / 未来桌面窗口
 (MCP 子进程)              (WS 客户端，接收渲染指令)
```

## 通信流程

```
1. Claude Desktop 按 mcpServers 配置启动 live2d-mcp 子进程
2. Claude Desktop → initialize → MCP Server 回复 capabilities
3. LLM 决定调用工具 → Claude Desktop → tools/call: live2d_expression(name="smile")
4. MCP Server:
   a. 验证 name 在模型表情列表中
   b. 通过内部 WS 广播 {type:"expression", name, params} 给渲染器
   c. 返回 {content: "表情已切换: smile"} 给 Claude
5. 渲染器收到 WS → 执行 Cubism 参数变更 → 视觉效果
```

## 配置文件

路径: `~/.live2d-mcp/config.json`

```json
{
  "model": {
    "path": "/absolute/path/to/character.model3.json"
  },
  "ws": {
    "port": 9228,
    "host": "127.0.0.1"
  }
}
```

- `model.path`: Cubism 3/4 的 .model3.json 绝对路径（必填）
- `ws.port`: 内部 WebSocket 端口（默认 9228）
- `ws.host`: 绑定地址（默认 127.0.0.1，安全约束）

首次运行 `live2d-mcp init` 交互式创建配置。

## 工具定义

### 1. live2d_expression

- **参数**: `name: string` — 表情名称
- **行为**: 从模型 `FileReferences.Expressions` 中查找对应 `.exp3.json`，提取参数列表并广播
- **验证**: name 必须在模型的表达式名称列表中
- **支持内置自定义表情**: smile, bigsmile, sad（通过 Cubism 参数公式实现）

### 2. live2d_motion

- **参数**: `name: string` — 动作组名称
- **行为**: 从模型 `FileReferences.Motions` 中查找对应动作组并广播
- **验证**: name 必须在模型的动作组列表中

### 3. live2d_status

- **参数**: 无
- **返回**: 模型名称、表情数量及列表、动作组数量及列表、可用预定义动画列表

### 4. live2d_parameter

- **参数**: `params: Array<{id: string, value: number, duration?: number, easing?: string}>`
- **行为**: 直接操控 Cubism 底层参数，广播给渲染器
- **常用参数**: ParamEyeLOpen(0-1), ParamAngleX, ParamAngleY, ParamAngleZ, ParamBreath, ParamMouthOpenY 等

### 5. live2d_animate

- **参数**: `name: string`
- **行为**: 播放预定义语义动画，转换为参数序列后广播
- **内置动画**: wink, slow_blink, double_blink, nod, shake_head, tilt_head
- **与模型解耦**: 使用通用参数公式，不依赖特定模型的表达式文件

## 目录结构

```
live2d-mcp/                      ← 独立仓库
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts                   ← CLI 入口: init/start 命令
│   ├── server.ts                ← MCP Server: STDIO + JSON-RPC 路由
│   ├── tools.ts                 ← 5 个工具的 define + execute
│   ├── model-reader.ts          ← 读 model3.json，解析表达式/动作索引
│   ├── expressions.ts           ← 表情注册: 模型表情 + 内置参数表情(smile等)
│   ├── animations.ts            ← 语义动画: wink/nod 等的参数序列定义
│   ├── ws-hub.ts                ← 内部 WS 广播(仅绑定 127.0.0.1)
│   ├── config.ts                ← ~/.live2d-mcp/config.json 读写
│   └── types.ts                 ← 共享类型
├── test/
│   └── test.ts                  ← 集成测试(STDIO 模拟)
└── README.md
```

## 关键决策

| 决策 | 理由 |
|------|------|
| 表情列表从模型文件动态读取 | 换模型自动换表情，不硬编码 |
| 语义动画用参数公式实现 | 不依赖模型 .exp3.json，跨模型通用 |
| WS 仅绑定 127.0.0.1 | 安全默认，不暴露到局域网 |
| `init` + `start` 两条命令 | init 交互引导首次配置，start 静默启动 |
| 从现有 `mcp-servers/live2d/` 提取逻辑 | 不重写，通用化改造现有代码 |
| 单进程架构 | Phase 1 最简交付，未来渲染窗口作为 WS 客户端接入 |

## 依赖

- `ws` — 内部 WebSocket
- `tsx` — dev 运行
- TypeScript strict mode
- 无 Pi SDK 依赖（完全独立）

## Phase 2 预留

- 桌面窗口渲染器 (Electron/Tauri) 作为独立 WS 客户端连接
- 模型热重载（文件变更自动重新读取 model3.json）
- 多渲染器支持（同一指令同时驱动多个窗口）
