# Personal Agent — 项目状态：流水线透视面板

> 2026-05-27 新增，2026-05-29 修复 Windows 兼容性

## v0.5.2 Windows 兼容性修复

修复新会话在侧边栏消失的问题，根因是三个 bug 叠加：
1. `cwdKey` 计算只处理 Unix 路径分隔符 `/`，Windows 的 `\` 和 `:` 未替换
2. `process.env.HOME` 在 Windows 上可能未设置
3. 前端 `groupByDate()` 不处理 `NaN` 时间戳

详见 `docs/observe-issues.md`。

## v0.4.1 BUG 修复（2026-05-28）

修复了 4 个会话切换相关的 BUG：
- pa-observe `session_start` 捕获 `sessionFile`/`sessionId` 写入 trace JSON
- API 匹配 key 从 `sessionId`(UUID) 改为 `sessionFile`(路径精确匹配)
- 前端 `fetchObserveTrace` 快照 `currentSessionFile`，`await` 后校验（竞态守卫）
- `session_state` 切换时重置时间戳 + 清空面板 DOM

## 功能

右侧可展开的调试面板，展示每轮 Agent 对话的完整内部流水线。

## 数据链路

```
pa-observe (Pi 扩展) → 写入 observe_last_trace.json
                       ↓
wgnr-pi /api/observe_trace → 前端 fetch → renderTrace()
```

不使用 WebSocket 推送，改用文件 + HTTP 轮询（打开面板后每 3 秒拉取）。

## 7 个追踪步骤

| # | 步骤 | 数据来源 |
|---|------|---------|
| 1 | System Prompt 组装 | `before_agent_start` |
| 2 | Context 消息列表 | `context` |
| 3 | API 请求体 | `before_provider_request` |
| 4 | API 响应 | `after_provider_response` |
| 5 | 工具调用 | `tool_execution_start/end` |
| 6 | 计数器检查 | `message_end` |
| 7 | 记忆提取 | `agent_end`（pa-mio 处理，pa-observe 仅报告状态） |

## 面板 UI

- 位置：`position: fixed; right: 0; top: 0; bottom: 0; width: 420px`
- 开关：右侧边缘 `🔍 流水线` 竖排按钮
- 展开/折叠：每个步骤点击标题切换
- 默认折叠所有步骤，API 请求体（Step 3）默认展开

## 涉及的文件

| 文件 | 改动 |
|------|------|
| `extensions/pa-observe/index.ts` | **新建** ~308 行 |
| `wgnr-pi/public/index.html` | CSS +150 行 / HTML +10 行 / JS +120 行 |
| `wgnr-pi/server.js` | 新增 `GET /api/observe_trace` 端点 |
| `.pi/settings.json` | extensions 数组新增 pa-observe |

---

**下一章**：
- 后续路线 → `05-roadmap.md`
