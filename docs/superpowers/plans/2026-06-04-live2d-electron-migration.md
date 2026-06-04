> **✅ 已完成** — Live2D 已迁移到独立 Electron 项目（packages/live2d-pet/），主应用中的旧代码已清理。详见 [mio-status-2026-06-05.md](../mio-status-2026-06-05.md)。

# Live2D Electron 迁移 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Live2D 渲染从浏览器迁移到 Electron 桌面宠物，移除所有旧 Live2D 代码，LLM 通过 MCP 协议控制。

**Architecture:** live2d-mcp 项目迁入 `packages/live2d-pet/`，Electron 桌面宠物通过 MCP adapter (STDIO → WS:9228) 接收 LLM 指令。personal-agent 前端不再渲染 Live2D。

**Tech Stack:** Electron, PIXI.js, Cubism SDK, WebSocket, Pi SDK (mcporter)

---

### Task 1: 迁入 live2d-mcp 项目

**Files:**
- Create: `packages/live2d-pet/` (完整目录，从 `D:\claude\live2d-mcp` 复制)
- Modify: `packages/live2d-pet/packages/desktop/src/main.ts` (端口 9229→9230)

- [ ] **Step 1: 复制项目到 packages/live2d-pet**

```bash
cp -r D:/claude/live2d-mcp d:/claude/personal-agent/packages/live2d-pet
```

- [ ] **Step 2: 删除不需要的目录（减少体积）**

```bash
rm -rf d:/claude/personal-agent/packages/live2d-pet/.git
rm -rf d:/claude/personal-agent/packages/live2d-pet/.claude
rm -rf d:/claude/personal-agent/packages/live2d-pet/.codegraph
rm -rf d:/claude/personal-agent/packages/live2d-pet/node_modules
rm -rf d:/claude/personal-agent/packages/live2d-pet/dist
rm -rf d:/claude/personal-agent/packages/live2d-pet/packages/core/node_modules
rm -rf d:/claude/personal-agent/packages/live2d-pet/packages/desktop/node_modules
rm -rf d:/claude/personal-agent/packages/live2d-pet/packages/desktop/dist
```

- [ ] **Step 3: 修复端口冲突 — HTTP_PORT 9229 → 9230**

打开 `packages/live2d-pet/packages/desktop/src/main.ts`，找到第 18 行：

```typescript
const HTTP_PORT = 9229
```

替换为：

```typescript
const HTTP_PORT = 9230
```

- [ ] **Step 4: 安装依赖**

```bash
cd d:/claude/personal-agent/packages/live2d-pet && npm install
```

- [ ] **Step 5: 验证 TypeScript 编译**

```bash
cd d:/claude/personal-agent/packages/live2d-pet && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
cd d:/claude/personal-agent && git add packages/live2d-pet && git commit -m "feat: 迁入 live2d-mcp Electron 桌面宠物"
```

---

### Task 2: 移除 pa-live2d Pi 扩展

**Files:**
- Delete: `extensions/pa-live2d/index.ts`

- [ ] **Step 1: 删除 pa-live2d 目录**

```bash
rm -rf d:/claude/personal-agent/extensions/pa-live2d
```

- [ ] **Step 2: Commit**

```bash
cd d:/claude/personal-agent && git add -A extensions/pa-live2d && git commit -m "refactor: 移除 pa-live2d Pi 扩展（MCP 替代）"
```

---

### Task 3: 移除旧 MCP server

**Files:**
- Delete: `mcp-servers/live2d/` (整个目录)

- [ ] **Step 1: 删除 mcp-servers/live2d**

```bash
rm -rf d:/claude/personal-agent/mcp-servers/live2d
```

- [ ] **Step 2: Commit**

```bash
cd d:/claude/personal-agent && git add -A mcp-servers && git commit -m "refactor: 移除旧 Live2D MCP server（新 MCP adapter 替代）"
```

---

### Task 4: 移除前端 Live2D 组件

**Files:**
- Delete: `frontend/src/extensions/live2d-view/` (整个目录)
- Delete: `frontend/src/shell/live2d-signal.ts`
- Delete: `frontend/src/shell/SceneLayer.tsx`
- Delete: `frontend/src/extensions/settings-page/Live2DPreview.tsx`

- [ ] **Step 1: 删除文件**

```bash
rm -rf d:/claude/personal-agent/frontend/src/extensions/live2d-view
rm d:/claude/personal-agent/frontend/src/shell/live2d-signal.ts
rm d:/claude/personal-agent/frontend/src/shell/SceneLayer.tsx
rm d:/claude/personal-agent/frontend/src/extensions/settings-page/Live2DPreview.tsx
```

- [ ] **Step 2: Commit**

```bash
cd d:/claude/personal-agent && git add -A frontend/src && git commit -m "refactor: 移除前端 Live2D 渲染组件"
```

---

### Task 5: 清理 bridge Live2D 中继代码

**Files:**
- Modify: `bridge/index.ts:66-114,123-127`
- Modify: `bridge/protocol.ts:71-77`

- [ ] **Step 1: 从 bridge/index.ts 删除 L2D hub 连接代码**

打开 `bridge/index.ts`，删除第 66-114 行：

```typescript
// ── 连接 live2d-mcp 的内部 WS hub（协议 v2）──
const L2D_HUB = 'ws://127.0.0.1:9228'
let l2dWs: WebSocket | null = null

function connectL2DHub(): void {
  if (l2dWs && l2dWs.readyState === WebSocket.OPEN) return
  l2dWs = new WebSocket(L2D_HUB)
  l2dWs.on('open', () => console.log('[bridge] connected to live2d-mcp hub'))
  l2dWs.on('message', (data) => {
    try {
      const raw = JSON.parse(data.toString()) as { type: string; [key: string]: unknown }
      let envelope: { type: string; id: string; sessionId: string; ts: number; payload: unknown }
      switch (raw.type) {
        case 'expression':
          envelope = {
            type: 'live2d.expression', id: generateUUID(), sessionId: '', ts: Date.now(),
            payload: { name: raw.name },
          }
          break
        case 'motion':
          envelope = {
            type: 'live2d.motion', id: generateUUID(), sessionId: '', ts: Date.now(),
            payload: { group: raw.group, index: raw.index },
          }
          break
        case 'parameter':
          envelope = {
            type: 'live2d.parameter', id: generateUUID(), sessionId: '', ts: Date.now(),
            payload: { params: raw.params },
          }
          break
        case 'animate':
          envelope = {
            type: 'live2d.animate', id: generateUUID(), sessionId: '', ts: Date.now(),
            payload: { animation: raw.animation, params: raw.params },
          }
          break
        default:
          return
      }
      broadcastToAll(JSON.stringify(envelope))
    } catch { /* ignore malformed messages */ }
  })
  l2dWs.on('close', () => { console.log('[bridge] live2d-mcp hub disconnected'); l2dWs = null })
  l2dWs.on('error', () => { l2dWs = null })
}
connectL2DHub()
// 断线重连（每 30s 尝试）
setInterval(() => { if (!l2dWs || l2dWs.readyState !== WebSocket.OPEN) connectL2DHub() }, 30000)
```

- [ ] **Step 2: 从 bridge/index.ts 删除 Live2D 中继代码**

删除第 123-127 行（在 `ws.on('message', ...)` handler 中的 Live2D 中继块）：

```typescript
      // Live2D 中继：MCP Server ↔ Bridge ↔ 浏览器
      if (msg.type === 'live2d.control' || msg.type === 'live2d.result') {
        broadcastToAll(raw.toString(), ws)
        return
      }
```

- [ ] **Step 3: 从 bridge/protocol.ts 删除 Live2D 消息类型**

打开 `bridge/protocol.ts`，删除第 70-77 行：

```typescript
  // Live2D 中继（v1 旧协议）
  | ServerMsg<'live2d.control', { tool: string; args: Record<string, string> }>
  | ServerMsg<'live2d.result', { text: string }>
  // Live2D v2 协议（通用化）
  | ServerMsg<'live2d.expression', { name: string }>
  | ServerMsg<'live2d.motion', { group: string; index: number }>
  | ServerMsg<'live2d.parameter', { params: Array<{ id: string; value: number; duration?: number; easing?: string }> }>
  | ServerMsg<'live2d.animate', { animation: string; params: Array<{ id: string; value: number; duration?: number; easing?: string }> }>
```

- [ ] **Step 4: Commit**

```bash
cd d:/claude/personal-agent && git add bridge/ && git commit -m "refactor: 移除 bridge Live2D 中继代码"
```

---

### Task 6: 清理 App.tsx + App.css

**Files:**
- Modify: `frontend/src/shell/App.tsx:1-7,98`
- Modify: `frontend/src/shell/App.css:1109-1222`

- [ ] **Step 1: 从 App.tsx 删除 Live2D 相关导入和使用**

打开 `frontend/src/shell/App.tsx`，删除第 2-3 行的导入：

```typescript
import { SceneLayer } from './SceneLayer'
```

（第 1 行不变，第 2 行删除 SceneLayer 导入）

删除第 6 行的导入：

```typescript
import { Live2DView } from '@/extensions/live2d-view/Live2DView'
```

（原来的 import 从 `@/registry` 变成第 2 行新的第一个 import）

删除第 95-98 行的 JSX 使用：

```tsx
      <SceneLayer />
      <TopMenuBar />
      <SettingsPage />
      <Live2DView />
```

改为：

```tsx
      <TopMenuBar />
      <SettingsPage />
```

最终 App.tsx 前几行应为：

```tsx
import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { registry, type Extension } from '@/registry'
import { TopMenuBar } from '@/extensions/top-menu/TopMenuBar'
import { SettingsPage } from '@/extensions/settings-page/SettingsPage'
import './App.css'
```

JSX 返回部分应为：

```tsx
  return (
    <>
      <TopMenuBar />
      <SettingsPage />
      <div
```

- [ ] **Step 2: 从 App.css 删除悬浮 Live2D 样式**

打开 `frontend/src/shell/App.css`，删除第 1109-1222 行（从 `/* ══════ 悬浮 Live2D 面板 ══════ */` 到文件末尾的所有 Live2D 样式）：

删除内容包括：
- `.floating-mio` 及所有变体 (active, dragging, docked-left, docked-right)
- `.mio-handle` 及变体
- `.mio-handle-bar`
- `.mio-view` 及变体
- `.mio-dot` 及变体
- `.mio-status-overlay`
- `.speech-bubble` 及其 keyframes (bub-in, bub-out)
- `.dock-indicator` 及变体
- `.mio-toggle` 及变体

- [ ] **Step 3: Commit**

```bash
cd d:/claude/personal-agent && git add frontend/src/shell/App.tsx frontend/src/shell/App.css && git commit -m "refactor: 清理 App.tsx/css Live2D 引用"
```

---

### Task 7: 清理 SettingsPage Live2D 设置

**Files:**
- Modify: `frontend/src/extensions/settings-page/SettingsPage.tsx`

- [ ] **Step 1: 删除 live2d-signal 导入**

打开 `frontend/src/extensions/settings-page/SettingsPage.tsx`，删除第 4 行：

```typescript
import { live2dWidth, setLive2dWidth, live2dHeight, setLive2dHeight, live2dScale, setLive2dScale, live2dOffsetX, setLive2dOffsetX, live2dOffsetY, setLive2dOffsetY } from '@/shell/live2d-signal'
```

- [ ] **Step 2: 删除 'live2d' Tab 类型**

找到第 6 行：

```typescript
type SettingsTab = 'agent' | 'live2d'
```

改为：

```typescript
type SettingsTab = 'agent'
```

- [ ] **Step 3: 删除 Live2D Tab 按钮**

删除 `🎭` 表情符号对应的 Tab 按钮（约第 103-108 行）：

```tsx
            classList={{ active: settingsTab() === 'live2d' }}
            onClick={() => setSettingsTab('live2d')}
          >
            <span class="nav-icon">🎭</span> Live2D 设置
```

- [ ] **Step 4: 删除 Live2D 设置面板内容**

删除从 `{/* ══════════ Live2D 设置 ══════════ */}` 开始到 `{settingsTab() === 'live2d' && (` 对应的整个闭合块（约第 244 行到对应的 `)}` 结束处）。

- [ ] **Step 5: Commit**

```bash
cd d:/claude/personal-agent && git add frontend/src/extensions/settings-page/ && git commit -m "refactor: 移除 SettingsPage Live2D 设置 Tab"
```

---

### Task 8: 清理 SessionPanel + index.tsx

**Files:**
- Modify: `frontend/src/extensions/session-panel/SessionPanel.tsx:3,58-72`
- Modify: `frontend/src/index.tsx:15`

- [ ] **Step 1: 从 SessionPanel.tsx 删除 live2dVisible 相关代码**

打开 `frontend/src/extensions/session-panel/SessionPanel.tsx`，删除第 3 行导入：

```typescript
import { live2dVisible, setLive2dVisible } from '@/shell/live2d-signal'
```

删除第 58-72 行的切换按钮：

```tsx
        <button
          onClick={(e) => { e.stopPropagation(); setLive2dVisible(!live2dVisible()) }}
          title={live2dVisible() ? '隐藏澪号' : '显示澪号'}
          style={{
            background: live2dVisible() ? 'rgba(139,156,240,0.12)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: live2dVisible() ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer', 'border-radius': '6px',
            padding: '3px 8px', 'font-size': '12px',
            'flex-shrink': '0', 'font-family': 'inherit',
            transition: 'all 0.15s',
          }}
        >
          🎭
        </button>
```

- [ ] **Step 2: 从 index.tsx 删除 live2d-view 导入**

打开 `frontend/src/index.tsx`，删除第 15 行：

```typescript
import './extensions/live2d-view'
```

- [ ] **Step 3: Commit**

```bash
cd d:/claude/personal-agent && git add frontend/src/index.tsx frontend/src/extensions/session-panel/SessionPanel.tsx && git commit -m "refactor: 清理 SessionPanel 和 index Live2D 引用"
```

---

### Task 9: 更新 Pi 扩展注册

**Files:**
- Modify: `bridge/.pi/settings.json`

- [ ] **Step 1: 移除 pa-live2d，保持两个核心扩展**

打开 `bridge/.pi/settings.json`，内容改为：

```json
{
  "extensions": [
    "D:/claude/personal-agent/extensions/pa-mio/index.ts",
    "D:/claude/personal-agent/extensions/pa-files/index.ts"
  ]
}
```

注意：MCP adapter 的注册方式取决于 Pi 的 mcporter 配置。如果 Pi 支持 `.pi/settings.json` 中注册 MCP server，则添加 MCP 条目；如果 Pi 通过 Claude Desktop 的 `claude_desktop_config.json` 来注册 MCP server，则在 Task 10 中通过 Claude Desktop 配置注册。当前暂不在此文件中注册 MCP adapter。

- [ ] **Step 2: Commit**

```bash
cd d:/claude/personal-agent && git add bridge/.pi/settings.json && git commit -m "refactor: 从 Pi 注册表移除 pa-live2d"
```

---

### Task 10: 验证 — TypeScript 检查

**Files:** 无

- [ ] **Step 1: 运行 TypeScript 检查**

```bash
cd d:/claude/personal-agent/bridge && npx tsc --noEmit 2>&1
```

预期：无 Live2D 相关报错。如有报错，确认不是本次改动的残留引用，修复后重新检查。

- [ ] **Step 2: 检查前端 TypeScript**

虽无 `tsc` 命令（前端由 Vite 处理），但需确认 Vite dev server 无报错：

```bash
cd d:/claude/personal-agent/frontend && npx vite build --logLevel error 2>&1
```

- [ ] **Step 3: 全局 grep 确认无残留引用**

```bash
cd d:/claude/personal-agent && rg -i "live2d-view|live2d-signal|SceneLayer|pa-live2d|live2d\.control|Live2DPreview" --type ts --type tsx --type css -l 2>/dev/null
```

预期结果为空（除了 `packages/live2d-pet/` 内的引用和 spec/plan 文档）。

- [ ] **Step 4: Commit（如有修复）**

```bash
cd d:/claude/personal-agent && git add -A && git commit -m "chore: TypeScript 检查 + 残留引用清理"
```

---

### Task 11: MCP adapter 注册 + 端到端验证

**Files:**
- Modify: 用户的 Claude Desktop 配置 (mcpServers 条目)

- [ ] **Step 1: 在 Claude Desktop 配置中注册 MCP adapter**

在用户的 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "live2d": {
      "command": "npx",
      "args": ["tsx", "D:/claude/personal-agent/packages/live2d-pet/packages/adapters/mcp/src/index.ts"]
    }
  }
}
```

- [ ] **Step 2: 验证 MCP adapter 可启动**

```bash
cd d:/claude/personal-agent && echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | npx tsx packages/live2d-pet/packages/adapters/mcp/src/index.ts 2>&1
```

预期：输出 `{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05",...}}`

- [ ] **Step 3: 启动 Electron 桌面宠物**

```bash
cd d:/claude/personal-agent/packages/live2d-pet/packages/desktop && npx electron .
```

确认：桌面出现透明悬浮窗，model 就绪状态。

- [ ] **Step 4: 端到端测试 — 加载模型 + 切换表情**

通过 WebSocket 发送测试指令：

```bash
cd d:/claude/personal-agent/packages/live2d-pet && npx tsx test/test.ts
```

或手动测试：

```bash
# 另开终端，通过 wscat 或简单脚本连 WS:9228 发送指令
```

- [ ] **Step 5: Commit + CHANGELOG 更新**

更新 CHANGELOG.md，记录本次意图。

```bash
cd d:/claude/personal-agent && git add CHANGELOG.md && git commit -m "docs: 更新 CHANGELOG — Live2D Electron 迁移"
```
