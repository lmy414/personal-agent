> **✅ 已完成** — Live2D 已迁移到独立 Electron 项目（packages/live2d-pet/），主应用中的旧代码已清理。详见 [mio-status-2026-06-05.md](../mio-status-2026-06-05.md)。

# Live2D Electron 迁移 — 设计 Spec

> 日期: 2026-06-04 | 状态: design-approved

## 一、目标

将 Live2D 渲染从浏览器迁移到独立 Electron 桌面宠物窗口，通过 MCP 协议让 LLM 控制。移除 personal-agent 中所有旧 Live2D 代码。

## 二、架构

```
终端 1: personal-agent (bridge + frontend)
终端 2: Electron 桌面宠物 (packages/live2d-pet/packages/desktop)

LLM (DeepSeek via Pi) → Pi mcporter → MCP adapter (STDIO) → WS(:9228) → Electron
Claude Desktop         → MCP adapter (STDIO) ─────────────→ WS(:9228) → Electron
```

personal-agent 不直接控制 Live2D。LLM 通过标准 MCP 协议与 Electron 桌面宠物通信。

## 三、端口

| 端口 | 服务 |
|------|------|
| 9229 | Bridge WS (personal-agent，不变) |
| 9228 | Electron Desktop WS (MCP 指令通道) |
| 9230 | Electron HTTP (模型文件静态服务，原 9229 改为 9230 避让 Bridge) |

## 四、移除清单

### 6 个文件/目录

| 路径 | 原因 |
|------|------|
| `frontend/src/extensions/live2d-view/` | 浏览器 PIXI Live2D 渲染，Electron 替代 |
| `frontend/src/shell/live2d-signal.ts` | 面板尺寸/位置信号，Electron 自己管 |
| `frontend/src/shell/SceneLayer.tsx` | 场景层，不再需要 |
| `frontend/src/extensions/settings-page/Live2DPreview.tsx` | 已废弃 |
| `extensions/pa-live2d/` | Pi 扩展，MCP adapter 替代 |
| `mcp-servers/live2d/` | 旧 MCP server，新 MCP adapter 替代 |

### 代码片段

| 文件 | 删除内容 |
|------|----------|
| `bridge/index.ts` | L2D hub 连接 + Live2D 中继代码 (~65 行) |
| `bridge/protocol.ts` | Live2D 消息类型定义 (7 行) |
| `bridge/.pi/settings.json` | pa-live2d 注册（改为注册 MCP adapter） |

## 五、修改清单

| 文件 | 改动 |
|------|------|
| `frontend/src/shell/App.tsx` | 删除 `<SceneLayer />` + `<Live2DView />` |
| `frontend/src/shell/App.css` | 删除 `.floating-mio` 等悬浮窗样式 |
| `frontend/src/extensions/settings-page/SettingsPage.tsx` | 删除 Live2D 设置 Tab，删除 live2d-signal import |
| `frontend/src/index.tsx` | 删除 live2d-view 相关引用（如有） |
| `bridge/index.ts` | 删除 L2D hub 连接 (L66-114)、Live2D 中继 (L123-127)、live2d 广播逻辑 |
| `bridge/protocol.ts` | 删除 `live2d.control/result/expression/motion/parameter/animate` 类型 |

## 六、新增

```
packages/live2d-pet/           ← 从 D:\claude\live2d-mcp 迁入，保留完整目录结构
├── package.json               ← npm workspace
├── packages/
│   ├── core/                  ← PIXI + Cubism 引擎
│   ├── desktop/               ← Electron 主进程 + 渲染进程
│   │   ├── src/main.ts        ←   主进程 (WS:9228, HTTP:9230)
│   │   ├── src/preload.ts     ←   IPC bridge (window.l2dPet)
│   │   ├── src/settings.ts    ←   设置持久化
│   │   └── src/renderer/      ←   渲染进程 (app.js, index.html, settings.html)
│   ├── hub/                   ← 消息中心
│   ├── protocol/              ← 共享类型
│   └── adapters/mcp/          ← MCP JSON-RPC 适配器
├── src/                       ← CLI + 工具定义
│   ├── cli.ts, server.ts, tools.ts
│   ├── model-reader.ts, expressions.ts, animations.ts
│   ├── ws-hub.ts, config.ts, types.ts
│   └── test-repl.ts
└── test/
```

## 七、Pi 配置变更

`bridge/.pi/settings.json` 中注册 MCP adapter 替代 pa-live2d：

```json
{
  "extensions": [
    "extensions/pa-mio/index.ts",
    "extensions/pa-files/index.ts",
    {
      "type": "mcp",
      "command": "npx",
      "args": ["tsx", "packages/live2d-pet/packages/adapters/mcp/src/index.ts"]
    }
  ]
}
```

Pi 通过 mcporter 启动 MCP adapter 子进程，LLM 自动获得 7 个 Live2D 工具：

| 工具 | 说明 |
|------|------|
| `model_load` | 加载模型目录 |
| `expression_list` | 列出可用表情 |
| `expression_set` | 切换表情 |
| `action_list` | 列出语义动作 |
| `action_perform` | 执行语义动作 (nod/wink/blink...) |
| `settings_get` | 读取窗口/模型设置 |
| `settings_set` | 修改窗口/模型设置 |

## 八、启动流程

```bash
# 1. 安装依赖
cd packages/live2d-pet && npm install
cd packages/live2d-pet/packages/desktop && npm install

# 2. 确保 SDK 文件就位
# packages/desktop/dist/vendor/
#   ├── live2dcubismcore.min.js  ← 用户自行获取 (Live2D 专有)
#   ├── pixi.min.js              ← npm install pixi.js@6.5.10
#   └── cubism4.min.js           ← npm install pixi-live2d-display@0.4.0

# 3. 配置模型路径
node packages/live2d-pet/dist/cli.js init

# 4. 终端 1 — 启动 personal-agent
cd bridge && npm run dev
cd frontend && npm run dev

# 5. 终端 2 — 启动桌面宠物
cd packages/live2d-pet/packages/desktop
npx electron .
```

## 九、端口改动

`packages/desktop/src/main.ts` 中 `HTTP_PORT` 从 `9229` 改为 `9230`，避免与 Bridge WS 冲突。

## 十、非目标

- 不保留 v1/v2 Live2D 协议向后兼容
- 不迁移旧 Live2DView 的 UI 功能（气泡、拖拽停靠、Ghost 模式）— 后续在 Electron 端重新实现
- 不在这次改动中调整 personal-agent 的 monorepo workspace 配置
- 不迁移模型文件（用户自行放置）

## 十一、成功标准

1. `bridge/` 和 `frontend/` 中无 Live2D 相关代码残留
2. Electron 桌面宠物可独立启动，显示 Live2D 模型
3. LLM 可通过 MCP 工具控制桌面宠物的表情和动作
4. personal-agent 前端正常运作（对话、文件浏览、设置等不受影响）
5. `npm run check` 通过
