# 设置系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建设置系统含菜单栏、设置全页面、Bridge 协议、DeepSeek 模型接入

**Architecture:** 三 Phase 递进。Phase 1 桥接层 settings handler + SQLite 读写。Phase 2 前端 TopMenuBar + SettingsPage 连接真实协议。Phase 3 Pi modelRegistry 集成实现模型自动发现。

**Tech Stack:** TypeScript strict, SolidJS + Tailwind CSS (前端), Node + Pi SDK (桥接)

---

## Phase 1: Bridge 协议 + 数据层

### Task 1: 协议新增 settings 消息类型

**Files:**
- Modify: `bridge/protocol.ts`

- [ ] **Step 1: 在 protocol.ts 添加 settings 消息类型**

在 `ClientMessage` 联合类型末尾（`| ClientMsg<'session.state', {}>` 之后）添加：

```ts
  | ClientMsg<'settings.get', {}>
  | ClientMsg<'settings.set', { key: string; value: string }>
```

在 `ServerMessage` 联合类型末尾（`| ServerMsg<'error', ...>` 之前）添加：

```ts
  | ServerMsg<'settings.state', { entries: { key: string; value: string }[] }>
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd bridge && npx tsc --noEmit 2>&1 | grep -v "vendor/pi"
```

Expected: no output (clean compile)

- [ ] **Step 3: Commit**

```bash
git add bridge/protocol.ts
git commit -m "feat: protocol 新增 settings.get/set/state 消息类型"
```

---

### Task 2: 新建 settings handler

**Files:**
- Create: `bridge/handlers/settings.ts`
- Modify: `bridge/dispatcher.ts`

- [ ] **Step 1: 创建 handler 文件**

```ts
import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { getDB } from '../db'

export function handleSettingsGet(_msg: ClientMessage, ws: WebSocket): void {
  const db = getDB()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  ws.send(JSON.stringify({
    type: 'settings.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { entries: rows },
  }))
}

export function handleSettingsSet(msg: ClientMessage, ws: WebSocket): void {
  const { key, value } = msg.payload as { key: string; value: string }
  const db = getDB()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  handleSettingsGet(msg, ws)
}
```

- [ ] **Step 2: 注册到 dispatcher**

在 `dispatcher.ts` 的 import 中添加：
```ts
import { handleSettingsGet, handleSettingsSet } from './handlers/settings'
```

在 `routes` 对象中添加：
```ts
  'settings.get': handleSettingsGet,
  'settings.set': handleSettingsSet,
```

- [ ] **Step 3: 验证编译**

```bash
cd bridge && npx tsc --noEmit 2>&1 | grep -v "vendor/pi"
```

Expected: no output

- [ ] **Step 4: 初始化默认设置值**

在 `bridge/index.ts` 的 `initDB()` 之后添加默认设置写入：

```ts
// 初始化默认设置（首次运行）
const existing = db.prepare("SELECT COUNT(*) as cnt FROM settings").get() as { cnt: number }
if (existing.cnt === 0) {
  const defaults: [string, string][] = [
    ['default_model', 'deepseek-chat'],
    ['thinking_level', 'medium'],
    ['compact_threshold', '80'],
    ['history_retention', '100'],
    ['providers', JSON.stringify([{ id: 'deepseek', name: 'DeepSeek', apiKey: '', active: true }])],
  ]
  const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  for (const [k, v] of defaults) insert.run(k, v)
}
```

- [ ] **Step 5: Commit**

```bash
git add bridge/handlers/settings.ts bridge/dispatcher.ts bridge/index.ts
git commit -m "feat: settings.get/set handler + 默认值初始化"
```

---

### Task 3: useAgent 新增 settings API

**Files:**
- Modify: `frontend/src/shell/useAgent.tsx`

- [ ] **Step 1: 添加 settings actions 到 AgentActions 接口**

在 `AgentActions` 接口中添加：
```ts
  getSettings: () => void
  setSetting: (key: string, value: string) => void
```

- [ ] **Step 2: 添加 settings 状态**

在 Provider 中，`status` 定义之后添加：
```ts
const [settings, setSettings] = createSignal<{ key: string; value: string }[]>([])
```

- [ ] **Step 3: 实现 getSettings 和 setSetting**

在 `switchModel` 之后添加：
```ts
const getSettings = () => send('settings.get', {})
const setSetting = (key: string, value: string) => send('settings.set', { key, value })
```

- [ ] **Step 4: 处理 settings.state 消息**

在 `handleServerMessage` 的 switch 中添加：
```ts
case 'settings.state':
  setSettings((msg.payload as { entries: { key: string; value: string }[] }).entries)
  break
```

- [ ] **Step 5: 暴露到 Context**

在 `AgentContextValue` 接口中添加：
```ts
  settings: () => { key: string; value: string }[]
  getSettings: () => void
  setSetting: (key: string, value: string) => void
```

在 `value` 对象中添加：
```ts
  settings,
  getSettings,
  setSetting,
```

- [ ] **Step 6: 验证编译**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no output

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shell/useAgent.tsx
git commit -m "feat: useAgent 新增 settings/getSettings/setSetting API"
```

---

## Phase 2: 前端骨架

### Task 4: 样式迁移 — 菜单栏 + 设置页 CSS

**Files:**
- Modify: `frontend/src/shell/App.css`

- [ ] **Step 1: 从原型提取 CSS 追加到 App.css**

在 `App.css` 末尾追加以下全部样式：

```css
/* ====== 顶部菜单栏：圆角梯形 ====== */
.top-menu-toggle {
  position: fixed; top: 0; left: 50%; transform: translateX(-50%);
  z-index: 50;
  width: 40px; height: 14px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-top: none;
  border-radius: 0 0 10px 10px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.25s ease;
  opacity: 0.55;
}
.top-menu-toggle:hover { opacity: 1; height: 18px; }
.top-menu-toggle .toggle-arrow {
  font-size: 8px; color: var(--text-secondary);
  transition: transform 0.3s ease;
  line-height: 1;
}
.top-menu-toggle.open .toggle-arrow { transform: rotate(180deg); }

.top-menu-bar {
  position: fixed; top: 0; left: 50%; transform: translateX(-50%) translateY(-100%);
  z-index: 45;
  width: 480px;
  clip-path: polygon(0 0, 100% 0, 94% 100%, 6% 100%);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-top: none;
  border-radius: 0 0 20px 20px;
  padding: 20px 0 16px 0;
  display: flex; align-items: center; justify-content: center; gap: 24px;
  transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
  pointer-events: auto;
}
.top-menu-bar.open { transform: translateX(-50%) translateY(0); }

.top-menu-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 10px 22px; border-radius: 12px;
  cursor: pointer; user-select: none;
  color: var(--text-secondary); font-size: 12px;
  transition: all 0.18s;
  background: transparent; border: none; font-family: inherit;
}
.top-menu-item:hover { background: rgba(255,255,255,0.06); color: var(--text-primary); }
.top-menu-item .menu-icon { font-size: 20px; line-height: 1; }
.top-menu-item .menu-label { font-size: 11px; letter-spacing: 0.5px; }

/* ====== 设置全页面 ====== */
.settings-page {
  position: fixed; inset: 0; z-index: 55;
  display: flex; flex-direction: column;
  background: #0a0a18;
  opacity: 0; pointer-events: none;
  transition: opacity 0.3s;
}
.settings-page.open { opacity: 1; pointer-events: auto; }

.settings-page-header {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 24px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
  background: rgba(15,15,30,0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.settings-back-btn {
  width: 34px; height: 34px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: var(--text-secondary); cursor: pointer;
  font-size: 16px; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.settings-back-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
.settings-page-title { font-size: 16px; font-weight: 500; color: var(--text-primary); }
.settings-page-subtitle { font-size: 12px; color: var(--text-muted); margin-left: auto; }

.settings-page-body { flex: 1; display: flex; min-height: 0; }

.settings-nav {
  width: 200px; flex-shrink: 0;
  border-right: 1px solid rgba(255,255,255,0.06);
  padding: 16px 0;
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
}
.settings-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 20px; font-size: 13px; color: var(--text-secondary);
  cursor: pointer; user-select: none;
  border-left: 2px solid transparent;
  transition: all 0.15s;
}
.settings-nav-item:hover { color: var(--text-primary); background: rgba(255,255,255,0.03); }
.settings-nav-item.active {
  color: var(--text-primary);
  background: rgba(139,156,240,0.06);
  border-left-color: var(--accent);
}
.settings-nav-item .nav-icon { font-size: 15px; width: 20px; text-align: center; }

.settings-content { flex: 1; overflow-y: auto; padding: 24px 32px; min-width: 0; }
.settings-section { margin-bottom: 28px; }
.settings-section-title {
  font-size: 14px; font-weight: 600; color: var(--text-primary);
  margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
}
.settings-section-desc {
  font-size: 11px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.5;
}

/* 厂商卡片 */
.provider-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.provider-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  transition: all 0.18s;
}
.provider-card .provider-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
  background: rgba(255,255,255,0.06);
}
.provider-card .provider-info { flex: 1; min-width: 0; }
.provider-card .provider-name { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.provider-card .provider-status { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.provider-card .provider-check { font-size: 13px; color: #4ade80; flex-shrink: 0; }

.provider-add-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px; margin-top: 10px;
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.10);
  border-radius: 12px;
  cursor: pointer; user-select: none;
  color: var(--text-muted); font-size: 13px;
  transition: all 0.18s;
  font-family: inherit; width: 100%;
}
.provider-add-btn:hover {
  background: rgba(139,156,240,0.04);
  border-color: rgba(139,156,240,0.20);
  color: var(--accent);
}

/* 模型表格 */
.model-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.model-table thead th {
  text-align: left; padding: 8px 12px;
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1px; color: var(--text-muted);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.model-table tbody td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  color: var(--text-secondary);
  vertical-align: middle;
}
.model-table tbody tr { transition: background 0.12s; cursor: pointer; }
.model-table tbody tr:hover { background: rgba(255,255,255,0.03); }
.model-table tbody tr.expanded { background: rgba(139,156,240,0.04); }
.model-table .model-name { color: var(--text-primary); font-weight: 500; }
.model-table .model-provider { font-size: 11px; color: var(--text-muted); }
.model-table .model-cw {
  font-family: "Cascadia Code", "Fira Code", monospace;
  font-size: 11px; color: var(--text-muted);
}
.model-table .model-default-star {
  color: var(--accent); font-size: 14px; cursor: pointer;
  transition: transform 0.15s;
}
.model-table .model-default-star:hover { transform: scale(1.2); }
.model-table .model-default-star.inactive { color: rgba(255,255,255,0.12); }

.model-config-row { display: none; }
.model-config-row.open { display: table-row; }
.model-config-row td {
  padding: 14px 20px !important;
  background: rgba(139,156,240,0.03);
  border-bottom: 1px solid rgba(139,156,240,0.06) !important;
}
.model-params { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.model-param { display: flex; align-items: center; gap: 8px; }
.model-param-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
.model-param-value { flex: 1; display: flex; justify-content: flex-end; }
.model-param select, .model-param input[type="number"] {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 6px;
  color: var(--text-primary); font-size: 11px;
  padding: 4px 8px; outline: none;
}
.model-param select { cursor: pointer; font-family: inherit; }
.model-param select:focus, .model-param input[type="number"]:focus {
  border-color: rgba(139,156,240,0.35);
}
.model-toggle {
  width: 34px; height: 20px; border-radius: 10px;
  background: rgba(255,255,255,0.10);
  border: none; cursor: pointer; position: relative;
  transition: background 0.2s; flex-shrink: 0;
}
.model-toggle.on { background: rgba(139,156,240,0.35); }
.model-toggle::after {
  content: ""; position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: white; transition: transform 0.2s;
}
.model-toggle.on::after { transform: translateX(14px); }

/* 设置表单行 */
.settings-form-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 10px;
  margin-bottom: 8px;
}
.settings-form-label { font-size: 13px; color: var(--text-secondary); white-space: nowrap; min-width: 90px; }
.settings-form-value { flex: 1; display: flex; justify-content: flex-end; align-items: center; gap: 8px; }

.settings-select {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 8px;
  color: var(--text-primary); font-size: 12px;
  padding: 6px 10px; outline: none;
  cursor: pointer; min-width: 160px;
  font-family: inherit;
}
.settings-select:focus { border-color: rgba(139,156,240,0.35); }
.settings-select option { background: #1a1a2e; color: var(--text-primary); }

.settings-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 8px;
  color: var(--text-primary); font-size: 12px;
  padding: 6px 10px; outline: none;
  width: 80px; text-align: right;
  font-family: "Cascadia Code", "Fira Code", monospace;
  transition: border-color 0.2s;
}
.settings-input:focus { border-color: rgba(139,156,240,0.35); }
.settings-input-unit { font-size: 11px; color: var(--text-muted); min-width: 20px; }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/shell/App.css
git commit -m "style: 从原型迁移菜单栏+设置页 CSS 到 App.css"
```

---

### Task 5: TopMenuBar 组件

**Files:**
- Create: `frontend/src/extensions/top-menu/index.ts`
- Create: `frontend/src/extensions/top-menu/TopMenuBar.tsx`

- [ ] **Step 1: 创建注册文件**

`index.ts`:
```ts
import { registry } from '@/registry'
import { TopMenuBar } from './TopMenuBar'

registry.register({
  id: 'top-menu',
  slot: 'center',
  component: TopMenuBar,
})
```

- [ ] **Step 2: 创建组件**

`TopMenuBar.tsx`:
```tsx
import { createSignal } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function TopMenuBar() {
  const { isSettingsOpen, setIsSettingsOpen } = useAgent()
  const [menuOpen, setMenuOpen] = createSignal(false)

  const handleToggle = () => {
    setMenuOpen(!menuOpen())
  }

  const handleOpenSettings = () => {
    setIsSettingsOpen(true)
    setMenuOpen(false)
  }

  const handleGoMain = () => {
    setIsSettingsOpen(false)
    setMenuOpen(false)
    // 切回主会话
  }

  return (
    <>
      <div
        class="top-menu-toggle"
        classList={{ open: menuOpen() }}
        onClick={handleToggle}
        title="菜单"
      >
        <span class="toggle-arrow">▼</span>
      </div>
      <div class="top-menu-bar" classList={{ open: menuOpen() }}>
        <button class="top-menu-item" onClick={handleOpenSettings}>
          <span class="menu-icon">⚙</span>
          <span class="menu-label">设置</span>
        </button>
        <button class="top-menu-item" onClick={handleGoMain}>
          <span class="menu-icon">🎐</span>
          <span class="menu-label">主会话</span>
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 3: 在 useAgent 中暴露 isSettingsOpen**

在 `AgentContextValue` 接口中添加：
```ts
  isSettingsOpen: () => boolean
  setIsSettingsOpen: (v: boolean) => void
```

在 Provider 中添加 signal 并在 value 中暴露：
```ts
const [isSettingsOpen, setIsSettingsOpen] = createSignal(false)
```

- [ ] **Step 4: 入口引入 TopMenuBar**

在 `frontend/src/main.tsx`（或入口文件）中添加：
```ts
import './extensions/top-menu'
```

- [ ] **Step 5: 验证编译**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/extensions/top-menu/ frontend/src/shell/useAgent.tsx frontend/src/main.tsx
git commit -m "feat: TopMenuBar 圆角梯形菜单栏组件"
```

---

### Task 6: SettingsPage 组件

**Files:**
- Create: `frontend/src/extensions/settings-page/index.ts`
- Create: `frontend/src/extensions/settings-page/SettingsPage.tsx`
- Modify: `frontend/src/shell/App.tsx`

- [ ] **Step 1: 创建注册文件（仅注册不设 slot）**

`index.ts`:
```ts
import { registry } from '@/registry'
import { SettingsPage } from './SettingsPage'

registry.register({
  id: 'settings-page',
  slot: 'center',
  component: SettingsPage,
})
```

- [ ] **Step 2: 创建 SettingsPage 组件**

`SettingsPage.tsx` — 完整组件代码：

```tsx
import { createEffect, For, createSignal } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

// 工具函数：从 settings entries 中取值
function getSetting(entries: { key: string; value: string }[], key: string): string {
  return entries.find(e => e.key === key)?.value ?? ''
}

function formatCw(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n)
}

export function SettingsPage() {
  const { isSettingsOpen, setIsSettingsOpen, settings, getSettings, setSetting, availableModels } = useAgent()
  const [activeNav, setActiveNav] = createSignal('agent')
  const [expandedModelId, setExpandedModelId] = createSignal<string | null>(null)

  // 打开时拉取设置
  createEffect(() => {
    if (isSettingsOpen()) getSettings()
  })

  // 派生值
  const entries = () => settings()
  const defaultModel = () => getSetting(entries(), 'default_model') || 'deepseek-chat'
  const thinkingLevel = () => getSetting(entries(), 'thinking_level') || 'medium'
  const compactThreshold = () => getSetting(entries(), 'compact_threshold') || '80'
  const historyRetention = () => getSetting(entries(), 'history_retention') || '100'

  // ESC 关闭
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsSettingsOpen(false)
  }

  createEffect(() => {
    if (isSettingsOpen()) {
      window.addEventListener('keydown', handleKeyDown)
    } else {
      window.removeEventListener('keydown', handleKeyDown)
    }
  })

  // 更新设置
  const updateSetting = (key: string, value: string) => {
    setSetting(key, value)
  }

  // 模型列表（从 settings 或 availableModels 获取）
  const modelList = () => {
    // 先尝试从 settings.providers 获取
    const provRaw = getSetting(entries(), 'providers')
    if (provRaw) {
      try {
        const providers = JSON.parse(provRaw) as { id: string; name: string; models?: { id: string; name: string; contextWindow: number }[] }[]
        const models: { id: string; name: string; provider: string; contextWindow: number; enabled: boolean }[] = []
        for (const p of providers) {
          if (p.models) {
            for (const m of p.models) {
              models.push({ ...m, provider: p.name, enabled: true })
            }
          }
        }
        if (models.length > 0) return models
      } catch {}
    }
    // Fallback: 用 availableModels（Phase 3 自动发现）
    return (availableModels?.() ?? []).map(m => ({
      id: m.id,
      name: m.name,
      provider: 'DeepSeek',
      contextWindow: m.contextWindow,
      enabled: true,
    }))
  }

  if (!isSettingsOpen()) return null

  return (
    <div class="settings-page open">
      <div class="settings-page-header">
        <button class="settings-back-btn" onClick={() => setIsSettingsOpen(false)} title="返回">←</button>
        <span style="font-size:18px;">⚙</span>
        <span class="settings-page-title">设置</span>
        <span class="settings-page-subtitle">配置智能体行为和模型接入</span>
      </div>
      <div class="settings-page-body">
        {/* 左侧导航 */}
        <div class="settings-nav">
          <div class="settings-nav-item active" onClick={() => setActiveNav('agent')}>
            <span class="nav-icon">🤖</span> 智能体基础设置
          </div>
        </div>

        {/* 右侧内容 */}
        <div class="settings-content">
          {/* 已配置厂商 */}
          <div class="settings-section">
            <div class="settings-section-title">🔌 已配置厂商</div>
            <div class="settings-section-desc">当前已接入的模型厂商。新对话将使用默认模型创建。</div>
            <div class="provider-grid">
              <div class="provider-card">
                <div class="provider-icon">🟢</div>
                <div class="provider-info">
                  <div class="provider-name">DeepSeek</div>
                  <div class="provider-status">V3 / V4 Pro / R1</div>
                </div>
                <span class="provider-check">✓</span>
              </div>
            </div>
            <button class="provider-add-btn" title="后续版本支持接入更多厂商">
              <span style="font-size:16px;">+</span> 新增配置（即将推出）
            </button>
          </div>

          {/* 已接入模型 */}
          <div class="settings-section">
            <div class="settings-section-title">📋 已接入模型</div>
            <div class="settings-section-desc">点击行展开独立参数，★ 设为默认。</div>
            <table class="model-table">
              <thead>
                <tr><th>默认</th><th>模型</th><th>厂商</th><th>上下文</th><th>状态</th></tr>
              </thead>
              <tbody>
                <For each={modelList()}>
                  {(m) => {
                    const isDefault = m.id === defaultModel()
                    const isExpanded = expandedModelId() === m.id
                    return (
                      <>
                        <tr classList={{ expanded: isExpanded }} onClick={() => setExpandedModelId(isExpanded ? null : m.id)}>
                          <td onClick={(e) => e.stopPropagation()}>
                            <span
                              class={`model-default-star${isDefault ? '' : ' inactive'}`}
                              onClick={() => updateSetting('default_model', m.id)}
                              title={isDefault ? '当前默认' : '设为默认'}
                            >★</span>
                          </td>
                          <td class="model-name">{m.name}</td>
                          <td class="model-provider">{m.provider}</td>
                          <td class="model-cw">{formatCw(m.contextWindow)}</td>
                          <td style={{ 'font-size': '11px', color: m.enabled ? '#4ade80' : 'var(--text-muted)' }}>
                            {m.enabled ? '可用' : '已禁用'}
                          </td>
                        </tr>
                        <tr class={`model-config-row${isExpanded ? ' open' : ''}`}>
                          <td colspan="5">
                            <div class="model-params">
                              <div class="model-param">
                                <span class="model-param-label">思考强度</span>
                                <span class="model-param-value">
                                  <select value={thinkingLevel()} onChange={(e) => updateSetting('thinking_level', e.currentTarget.value)}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                  </select>
                                </span>
                              </div>
                              <div class="model-param">
                                <span class="model-param-label">启用</span>
                                <button class={`model-toggle${m.enabled ? ' on' : ''}`} onClick={(e) => { e.stopPropagation() }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      </>
                    )
                  }}
                </For>
              </tbody>
            </table>
          </div>

          {/* 默认参数 */}
          <div class="settings-section">
            <div class="settings-section-title">⚙ 默认参数</div>
            <div class="settings-form-row">
              <span class="settings-form-label">思考强度</span>
              <span class="settings-form-value">
                <select class="settings-select" value={thinkingLevel()} onChange={(e) => updateSetting('thinking_level', e.currentTarget.value)}>
                  <option value="low">Low — 快速响应</option>
                  <option value="medium">Medium — 均衡</option>
                  <option value="high">High — 深度思考</option>
                </select>
              </span>
            </div>
            <div class="settings-form-row">
              <span class="settings-form-label">压缩阈值</span>
              <span class="settings-form-value">
                <input class="settings-input" type="number" min="50" max="95"
                  value={compactThreshold()}
                  onChange={(e) => updateSetting('compact_threshold', e.currentTarget.value)} />
                <span class="settings-input-unit">%</span>
              </span>
            </div>
            <div class="settings-form-row">
              <span class="settings-form-label">历史保留</span>
              <span class="settings-form-value">
                <input class="settings-input" type="number" min="10" max="500"
                  value={historyRetention()}
                  onChange={(e) => updateSetting('history_retention', e.currentTarget.value)} />
                <span class="settings-input-unit">条</span>
              </span>
            </div>
            <div class="settings-form-row">
              <span class="settings-form-label">默认模型</span>
              <span class="settings-form-value">
                <span style="font-size:13px;color:var(--accent);font-weight:500;">{defaultModel()}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 入口引入**

在 `frontend/src/main.tsx` 中添加：
```ts
import './extensions/settings-page'
```

- [ ] **Step 4: 验证编译**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/extensions/settings-page/ frontend/src/main.tsx
git commit -m "feat: SettingsPage 设置全页面组件（左侧导航+右侧内容）"
```

---

## Phase 3: Pi 集成 + 模型自动发现

### Task 7: Bridge 模型发现 handler

**Files:**
- Modify: `bridge/handlers/settings.ts`
- Modify: `bridge/handlers/model.ts`

- [ ] **Step 1: 在 settings handler 中添加模型发现**

在 `bridge/handlers/settings.ts` 中添加：

```ts
import { getPiSession, getAvailableModels } from '../pi-session'

// 新增：settings.discover-models 消息 — 从 Pi registry 发现已配置厂商的模型
export function handleSettingsDiscoverModels(msg: ClientMessage, ws: WebSocket): void {
  const session = getPiSession(msg.sessionId)
  const models = getAvailableModels(session?.modelRegistry)
  const providers = new Map<string, { id: string; name: string; models: { id: string; name: string; contextWindow: number }[] }>()
  for (const m of models) {
    // DeepSeek 模型识别：id 包含 'deepseek'
    const provId = m.id.includes('deepseek') ? 'deepseek' : 'unknown'
    if (!providers.has(provId)) {
      providers.set(provId, { id: provId, name: provId === 'deepseek' ? 'DeepSeek' : provId, models: [] })
    }
    providers.get(provId)!.models.push(m)
  }
  // 写入 settings
  const db = getDB()
  const providerList = Array.from(providers.values())
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('providers', JSON.stringify(providerList))
  // 返回结果
  ws.send(JSON.stringify({
    type: 'settings.state',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: {
      entries: db.prepare('SELECT key, value FROM settings').all(),
    },
  }))
}
```

- [ ] **Step 2: 在 dispatcher 注册新消息类型（协议补充）**

在 `protocol.ts` 添加：
```ts
  | ClientMsg<'settings.discover-models', {}>
```

在 `dispatcher.ts` 添加：
```ts
  'settings.discover-models': handleSettingsDiscoverModels,
```

- [ ] **Step 3: 前端 settings 初始化时自动发现模型**

在 SettingsPage 的 `createEffect` 中，打开设置时发送发现请求：

```ts
createEffect(() => {
  if (isSettingsOpen()) {
    getSettings()
    // Phase 3: 自动发现模型（仅首次）
    send('settings.discover-models', {})
  }
})
```

(需要从 useAgent 中解构 `send`)

- [ ] **Step 4: 验证编译**

```bash
cd bridge && npx tsc --noEmit 2>&1 | grep -v "vendor/pi"
cd ../frontend && npx tsc --noEmit
```

Expected: both clean

- [ ] **Step 5: Commit**

```bash
git add bridge/handlers/settings.ts bridge/protocol.ts bridge/dispatcher.ts frontend/src/extensions/settings-page/SettingsPage.tsx
git commit -m "feat: settings.discover-models — Pi registry 自动发现 DeepSeek 模型"
```

---

### Task 8: 结束 — 合并到主干

- [ ] **Step 1: 前端 check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no output

- [ ] **Step 2: Bridge check**

```bash
cd bridge && npx tsc --noEmit 2>&1 | grep -v "vendor/pi"
```

Expected: no output

- [ ] **Step 3: 切回 master 并合并**

```bash
git checkout master
git merge feat/settings-system
```

- [ ] **Step 4: Push**

```bash
git push origin master
```

---

## 文件最终清单

| 类型 | 文件 | Phase |
|------|------|-------|
| 新增 | `bridge/handlers/settings.ts` | 1, 3 |
| 修改 | `bridge/protocol.ts` | 1, 3 |
| 修改 | `bridge/dispatcher.ts` | 1, 3 |
| 修改 | `bridge/index.ts` | 1 |
| 修改 | `frontend/src/shell/useAgent.tsx` | 1, 2 |
| 修改 | `frontend/src/shell/App.css` | 2 |
| 新增 | `frontend/src/extensions/top-menu/index.ts` | 2 |
| 新增 | `frontend/src/extensions/top-menu/TopMenuBar.tsx` | 2 |
| 新增 | `frontend/src/extensions/settings-page/index.ts` | 2 |
| 新增 | `frontend/src/extensions/settings-page/SettingsPage.tsx` | 2, 3 |
| 修改 | `frontend/src/main.tsx` | 2 |
| 修改 | `bridge/handlers/model.ts` | 3 |

**总计**: 12 文件（5 新增 + 7 修改），8 个 Task
