# Live2D to Agent

> 个人闲暇娱乐作品 — Live2D 桌面宠物，支持主流 Agent 通过 MCP 协议控制。
> 当前处于早期阶段。

将 Live2D 角色作为桌面宠物运行，AI Agent（Claude Desktop 等）可通过 MCP 协议控制其表情和动作。

## 前置依赖

运行前需自行获取以下文件，放入 `packages/desktop/dist/vendor/`：

| 文件 | 来源 | 许可 |
|------|------|------|
| `live2dcubismcore.min.js` | [Live2D Cubism SDK for Web](https://www.live2d.com/download/cubism-sdk/) | Live2D 专有软件许可 — 使用前请阅读并遵守其条款 |
| `pixi.min.js` | `npm install pixi.js@6.5.10`，从 `dist/browser/` 提取 | MIT |
| `cubism4.min.js` | `npm install pixi-live2d-display@0.4.0`，从 `dist/` 提取 | MIT |

Live2D Cubism Core 是 Live2D Inc. 的专有软件，本项目不包含、不分发该文件。

## 快速开始

```bash
# 安装依赖
cd packages/desktop
npm install

# 放置 SDK 文件（见上表）
mkdir -p dist/vendor
# 将三个文件放入 dist/vendor/

# 配置模型路径
node ../../dist/cli.js init

# 启动桌面宠物
npx electron .
```

## LLM 可控制的 MCP 工具

| 工具 | 参数 | 说明 |
|------|------|------|
| `model_load` | `path` | 加载模型（.model3.json 所在目录） |
| `expression_list` | — | 列出所有可用表情 |
| `expression_set` | `name` | 切换表情 |
| `action_list` | — | 列出可用语义动作 |
| `action_perform` | `name`, `intensity?`, `count?` | 执行语义动作 |
| `settings_get` | — | 读取桌面设置 |
| `settings_set` | 键值对 | 修改窗口/模型设置 |

### 语义动作

`nod` · `shake_head` · `tilt_head` · `wink` · `slow_blink` · `double_blink`

### 可调整设置

`window.width` · `window.height` · `window.x` · `window.y` · `window.opacity`
`model.scale` · `model.offsetX` · `model.offsetY`

## 配置 Claude Desktop

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "live2d": {
      "command": "npx",
      "args": ["tsx", "/path/to/live2d-to-agent/packages/adapters/mcp/src/index.ts"]
    }
  }
}
```

## 模型要求

- Cubism 3 或 4 格式 `.model3.json`
- 支持 `.exp3.json` 表情文件
- 使用前请确保模型授权允许个人使用

## 许可

本项目代码采用 MIT 协议。Live2D Cubism SDK 及其模型文件分别受各自许可条款约束。
