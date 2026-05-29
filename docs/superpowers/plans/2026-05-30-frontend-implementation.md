# 澪号 Frontend + Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete 澪号 Personal Agent UI (SolidJS + Tailwind) and WebSocket bridge server (Node.js + Pi SDK) from the design spec and prototype.

**Architecture:** CSS Grid shell renders 5 slot-based panels via an extension registry. A single `useAgent()` context hook provides WebSocket connection + global state to all extensions. The bridge server imports Pi SDK, translates Pi events to JSON over WebSocket, and routes incoming messages to handler modules.

**Tech Stack:** SolidJS, Tailwind CSS 3, Vite, TypeScript strict, Node.js + tsx, ws (WebSocket), Pi SDK, marked, highlight.js

**Reference files:**
- Design spec: `docs/superpowers/specs/2026-05-30-frontend-layout-design.md`
- UI prototype: `frontend-sketch/layout-mockup-v2.html`
- Project conventions: `CLAUDE.md`

---

## Phase 1: Project Scaffolding

### Task 1: Scaffold frontend project (Vite + SolidJS + Tailwind)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/index.tsx`

- [ ] **Step 1: Create package.json**

```bash
mkdir -p frontend/src && cd frontend
```

```json
{
  "name": "mio-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "solid-js": "^1.8.0",
    "marked": "^12.0.0",
    "highlight.js": "^11.9.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vite-plugin-solid": "^2.10.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd frontend && npm install
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { resolve } from 'path'

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
```

- [ ] **Step 5: Create tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 6: Create postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 7: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>澪号 Agent</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/index.tsx"></script>
</body>
</html>
```

- [ ] **Step 8: Create minimal entry point**

`frontend/src/index.tsx`:
```tsx
import { render } from 'solid-js/web'

function App() {
  return <div class="text-white bg-gray-900 min-h-screen">澪号</div>
}

render(() => <App />, document.getElementById('root')!)
```

- [ ] **Step 9: Verify dev server starts**

```bash
cd frontend && npm run dev
```

Expected: Vite dev server starts at `http://localhost:5173`, page shows "澪号" text.

- [ ] **Step 10: Verify TypeScript check passes**

```bash
cd frontend && npm run check
```

Expected: No errors.

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold frontend with Vite + SolidJS + Tailwind"
```

---

### Task 2: Scaffold bridge server

**Files:**
- Create: `bridge/package.json`
- Create: `bridge/tsconfig.json`

- [ ] **Step 1: Create package.json**

`bridge/package.json`:
```json
{
  "name": "mio-bridge",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "tsx index.ts",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "ws": "^8.17.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd bridge && npm install
```

- [ ] **Step 3: Create tsconfig.json**

`bridge/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "paths": {
      "@pi/*": ["../vendor/pi/packages/*/src"]
    }
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 4: Verify TypeScript check passes**

```bash
cd bridge && npx tsc --noEmit
```

Expected: No errors (no source files yet, so this should pass).

- [ ] **Step 5: Commit**

```bash
git add bridge/
git commit -m "chore: scaffold bridge server with tsx + ws"
```

---

## Phase 2: Protocol & Registry

### Task 3: Define WebSocket protocol types

**Files:**
- Create: `bridge/protocol.ts`

This is the single source of truth for all message types, shared by both frontend and bridge.

- [ ] **Step 1: Create protocol.ts**

`bridge/protocol.ts`:
```ts
// ========== 消息信封 ==========

export interface MessageEnvelope<T extends string = string, P = unknown> {
  type: T
  id: string
  sessionId: string
  ts: number
  payload: P
}

// ========== 客户端 → 服务端 ==========

export type ClientMessage =
  | ClientMsg<'session.create', { model?: string; thinkingLevel?: 'low' | 'medium' | 'high' }>
  | ClientMsg<'session.list', {}>
  | ClientMsg<'session.switch', { sessionId: string }>
  | ClientMsg<'session.delete', { sessionId: string }>
  | ClientMsg<'message.send', { content: string }>
  | ClientMsg<'message.cancel', {}>
  | ClientMsg<'model.switch', { modelId: string }>
  | ClientMsg<'model.list', {}>
  | ClientMsg<'file.list', { path?: string }>
  | ClientMsg<'file.read', { path: string }>
  | ClientMsg<'memory.search', { query: string }>
  | ClientMsg<'memory.list', { limit?: number; offset?: number }>

type ClientMsg<T extends string, P> = MessageEnvelope<T, P>

// ========== 服务端 → 客户端 ==========

export type ServerMessage =
  // 会话层
  | ServerMsg<'session.created', { sessionId: string; model: string; thinkingLevel: string; createdAt: number }>
  | ServerMsg<'session.list', { sessions: SessionInfo[] }>
  | ServerMsg<'session.state', { model: string; thinkingLevel: string; contextUsed: number; roundCount: number }>
  // 对话层
  | ServerMsg<'turn.start', { turnIndex: number }>
  | ServerMsg<'message.start', { messageId: string; role: 'user' | 'assistant' }>
  | ServerMsg<'message.delta', { messageId: string; delta: string }>
  | ServerMsg<'message.end', { messageId: string; content: string; usage: TokenUsage }>
  | ServerMsg<'turn.end', { turnIndex: number; usage: TokenUsage; cost: number }>
  // 工具层
  | ServerMsg<'tool.start', { toolCallId: string; toolName: string; input: Record<string, unknown> }>
  | ServerMsg<'tool.progress', { toolCallId: string; output: string }>
  | ServerMsg<'tool.end', { toolCallId: string; toolName: string; output: string; duration: number; status: 'success' | 'error' }>
  // 状态推送
  | ServerMsg<'status.update', StatusPayload>
  // 文件 & 记忆
  | ServerMsg<'file.list', { path: string; entries: FileEntry[] }>
  | ServerMsg<'file.content', { path: string; content: string; language?: string }>
  | ServerMsg<'memory.results', { query: string; entries: MemoryEntry[] }>
  | ServerMsg<'memory.list', { entries: MemoryEntry[]; total: number }>
  // 系统
  | ServerMsg<'compaction', { beforeTokens: number; afterTokens: number }>
  | ServerMsg<'error', { code: string; message: string; recoverable: boolean }>

type ServerMsg<T extends string, P> = MessageEnvelope<T, P>

// ========== 辅助类型 ==========

export interface SessionInfo {
  id: string
  title: string
  lastActive: number
  roundCount: number
}

export interface TokenUsage {
  input: number
  output: number
  total: number
}

export interface StatusPayload {
  tokens: number
  cost: number
  contextUsed: number
  contextMax: number
  roundCount: number
}

export interface FileEntry {
  name: string
  type: 'file' | 'directory'
  size?: number
}

export interface MemoryEntry {
  content: string
  category: string
  importance: number
}

// ========== 工具函数 ==========

export function createEnvelope<T extends string, P>(
  type: T,
  sessionId: string,
  payload: P
): MessageEnvelope<T, P> {
  return {
    type,
    id: crypto.randomUUID(),
    sessionId,
    ts: Date.now(),
    payload,
  }
}

export function parseMessage(raw: string): MessageEnvelope {
  return JSON.parse(raw) as MessageEnvelope
}
```

- [ ] **Step 2: Verify protocol.ts compiles**

```bash
cd bridge && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add bridge/protocol.ts
git commit -m "feat: WebSocket 协议类型定义"
```

---

### Task 4: Create extension registry

**Files:**
- Create: `frontend/src/registry.ts`

- [ ] **Step 1: Create registry.ts**

`frontend/src/registry.ts`:
```ts
import type { Component } from 'solid-js'

export type SlotId = 'left-top' | 'left-middle' | 'left-bottom' | 'center' | 'right'

export interface Extension {
  id: string
  slot: SlotId
  component: Component
  label?: string
  icon?: string
}

class ExtensionRegistry {
  private extensions: Extension[] = []

  register(ext: Extension): void {
    const existing = this.extensions.findIndex((e) => e.id === ext.id)
    if (existing !== -1) {
      this.extensions[existing] = ext
    } else {
      this.extensions.push(ext)
    }
  }

  getAll(): Extension[] {
    return this.extensions
  }

  getBySlot(slot: SlotId): Extension[] {
    return this.extensions.filter((e) => e.slot === slot)
  }

  getById(id: string): Extension | undefined {
    return this.extensions.find((e) => e.id === id)
  }
}

export const registry = new ExtensionRegistry()
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npm run check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/registry.ts
git commit -m "feat: 扩展注册表 registry.ts"
```

---

## Phase 3: Shell

### Task 5: Shell grid layout + SceneLayer

**Files:**
- Create: `frontend/src/shell/SceneLayer.tsx`
- Create: `frontend/src/shell/App.tsx`
- Create: `frontend/src/shell/App.css`
- Modify: `frontend/src/index.tsx`

This task builds the CSS Grid container and scene layer. All glass morphism CSS values come directly from the prototype at `frontend-sketch/layout-mockup-v2.html`.

- [ ] **Step 1: Create SceneLayer.tsx**

`frontend/src/shell/SceneLayer.tsx`:
```tsx
export function SceneLayer() {
  return (
    <div class="scene-layer">
      <div class="scene-bg" />
      <div class="character-sprite-placeholder">
        <span class="text-white/40 text-sm">Mio 立绘</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create App.css with all glass morphism and grid styles**

`frontend/src/shell/App.css`:
```css
/* ====== CSS Variables ====== */
:root {
  --glass-bg: rgba(15, 15, 25, 0.55);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur: blur(16px) saturate(140%);
  --text-primary: rgba(255, 255, 255, 0.92);
  --text-secondary: rgba(255, 255, 255, 0.55);
  --accent: #8b9cf0;
  --left-col: 400px;
  --right-panel-w: 0px;
  --gap: 10px;
  --margin: 12px;
}

/* ====== Reset ====== */
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body, #root {
  width: 100%; height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0a0a12;
  color: var(--text-primary);
}

/* ====== Scene Layer (z=0) ====== */
.scene-layer {
  position: fixed; inset: 0; z-index: 0;
}
.scene-bg {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}
.character-sprite-placeholder {
  position: absolute;
  bottom: 0; left: 50%;
  transform: translateX(-50%);
  height: 85vh; width: 320px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(to top, rgba(232,196,196,0.15), transparent);
  border-radius: 20px 20px 0 0;
  pointer-events: none;
  mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
}

/* ====== Glass base ====== */
.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
}

/* ====== Overlay Grid (z=10) ====== */
.overlay {
  position: fixed; inset: 0; z-index: 10;
  display: grid;
  grid-template-columns: var(--left-col) 1fr var(--right-panel-w);
  grid-template-rows: auto 1fr auto;
  gap: var(--gap);
  padding: var(--margin);
  pointer-events: none;
}
.overlay > * {
  pointer-events: auto;
}

/* Slot assignments */
.slot-left-top    { grid-column: 1; grid-row: 1; }
.slot-left-middle { grid-column: 1; grid-row: 2; overflow: hidden; display: flex; flex-direction: column; }
.slot-left-bottom { grid-column: 1; grid-row: 3; }
.slot-center      { grid-column: 2; grid-row: 1 / 4; }
.slot-right       { grid-column: 3; grid-row: 1 / 4; }

/* ====== Custom scrollbar ====== */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

/* ====== Right panel drag ====== */
.right-panel {
  position: relative;
  width: 100%;
  overflow: visible;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
}
.right-panel-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  word-break: break-all;
}
.drag-handle {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 30;
  background: transparent;
  transition: background 0.15s;
}
.drag-handle:hover,
.drag-handle.active {
  background: var(--accent);
}
.expand-tab {
  position: absolute;
  right: -28px; top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-lr;
  padding: 8px 4px;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  z-index: 35;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-left: none;
}
.expand-tab:hover {
  color: var(--accent);
}

/* ====== Tab bar ====== */
.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
}
.tab-btn {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  border: none;
  background: transparent;
  transition: all 0.15s;
  border-bottom: 2px solid transparent;
}
.tab-btn:hover { color: var(--text-primary); }
.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

/* ====== Utility ====== */
.hidden { display: none; }

/* ====== Message bubbles ====== */
@keyframes msgIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.message-enter {
  animation: msgIn 0.3s ease;
}
```

- [ ] **Step 3: Create App.tsx**

`frontend/src/shell/App.tsx`:
```tsx
import { createSignal, For } from 'solid-js'
import { SceneLayer } from './SceneLayer'
import { registry, type Extension } from '@/registry'
import './App.css'

function renderExtension(ext: Extension) {
  return <ext.component />
}

export function App() {
  const [rightPanelW, setRightPanelW] = createSignal(320)
  const [panelVisible, setPanelVisible] = createSignal(true)

  const handleDragStart = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = rightPanelW()

    const onMove = (ev: MouseEvent) => {
      const w = startW - (ev.clientX - startX)
      const clamped = Math.max(0, Math.min(640, w))
      setRightPanelW(clamped)

      if (clamped < 120 && w < 120) {
        setPanelVisible(false)
      } else if (clamped > 0) {
        setPanelVisible(true)
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleExpandClick = () => {
    setRightPanelW(320)
    setPanelVisible(true)
  }

  const effectiveWidth = () => panelVisible() ? rightPanelW() : 0

  return (
    <>
      <SceneLayer />
      <div
        class="overlay"
        style={{
          'grid-template-columns': `var(--left-col) 1fr ${effectiveWidth()}px`,
        }}
      >
        <div class="glass slot-left-top rounded-lg overflow-hidden">
          <For each={registry.getBySlot('left-top')}>{renderExtension}</For>
        </div>
        <div class="glass slot-left-middle rounded-lg overflow-hidden flex flex-col">
          <For each={registry.getBySlot('left-middle')}>{renderExtension}</For>
        </div>
        <div class="glass slot-left-bottom rounded-lg overflow-hidden">
          <For each={registry.getBySlot('left-bottom')}>{renderExtension}</For>
        </div>

        <div class="glass slot-center rounded-lg overflow-hidden flex flex-col">
          <For each={registry.getBySlot('center')}>{renderExtension}</For>
        </div>

        {/* Right slot: overflow-visible so expand-tab is not clipped */}
        <div class="glass slot-right rounded-lg right-panel" style={{ overflow: 'visible' }}>
          <div
            class="drag-handle"
            classList={{ active: false }}
            onMouseDown={handleDragStart}
            onDblClick={() => {
              setRightPanelW(0)
              setPanelVisible(false)
            }}
          />
          <div
            class="expand-tab"
            classList={{ hidden: panelVisible() }}
            onClick={handleExpandClick}
          >
            展开面板
          </div>
          <div class="right-panel-body">
            <For each={registry.getBySlot('right')}>{renderExtension}</For>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Update index.tsx**

`frontend/src/index.tsx`:
```tsx
import { render } from 'solid-js/web'
import { App } from './shell/App'
import './shell/App.css'

render(() => <App />, document.getElementById('root')!)
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend && npm run check
```

Expected: No errors.

- [ ] **Step 6: Visually verify in browser**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`. Expected: Dark background with gradient scene layer, character placeholder, empty glass panels in grid layout, expand tab on right edge.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shell/ frontend/src/index.tsx
git commit -m "feat: Shell Grid 布局 + SceneLayer"
```

---

### Task 6: WebSocket hook (useAgent)

**Files:**
- Create: `frontend/src/shell/useAgent.tsx`

- [ ] **Step 1: Create useAgent.tsx with context and provider**

`frontend/src/shell/useAgent.tsx`:
```tsx
import { createContext, createSignal, createStore, onCleanup, useContext, type Component, type JSX } from 'solid-js'
import type { MessageEnvelope, ServerMessage, StatusPayload, SessionInfo, TokenUsage } from '../../../bridge/protocol'

// ========== 全局状态类型 ==========

export interface ToolCallEntry {
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
  output: string
  duration: number
  status: 'running' | 'success' | 'error'
}

export interface MessageEntry {
  messageId: string
  role: 'user' | 'assistant'
  content: string
  partial: boolean
}

export interface AgentState {
  connected: boolean
  sessionId: string
  messages: MessageEntry[]
  toolCalls: ToolCallEntry[]
  status: StatusPayload
  sessions: SessionInfo[]
}

interface AgentActions {
  send: (type: string, payload: unknown) => void
  createSession: (model?: string) => void
  sendMessage: (content: string) => void
  cancelMessage: () => void
  switchSession: (sessionId: string) => void
  switchModel: (modelId: string) => void
}

type AgentContextValue = AgentState & AgentActions

// ========== Context ==========

const AgentContext = createContext<AgentContextValue>()

// ========== Provider ==========

export const AgentProvider: Component<{ sessionId: string; children: JSX.Element }> = (props) => {
  const [connected, setConnected] = createSignal(false)
  const [messages, setMessages] = createSignal<MessageEntry[]>([])
  const [toolCalls, setToolCalls] = createSignal<ToolCallEntry[]>([])
  const [sessions, setSessions] = createSignal<SessionInfo[]>([])
  const [status, setStatus] = createStore<StatusPayload>({
    tokens: 0, cost: 0, contextUsed: 0, contextMax: 128000, roundCount: 0,
  })

  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const connect = () => {
    ws = new WebSocket('ws://localhost:9229')

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data as string)
      handleServerMessage(msg)
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectTimer = setTimeout(connect, 2000)
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  const handleServerMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'message.start':
        setMessages((prev) => [...prev, {
          messageId: msg.payload.messageId,
          role: msg.payload.role,
          content: '',
          partial: true,
        }])
        break

      case 'message.delta':
        setMessages((prev) => prev.map((m) =>
          m.messageId === msg.payload.messageId && m.partial
            ? { ...m, content: m.content + msg.payload.delta }
            : m
        ))
        break

      case 'message.end':
        setMessages((prev) => prev.map((m) =>
          m.messageId === msg.payload.messageId
            ? { ...m, content: msg.payload.content, partial: false }
            : m
        ))
        break

      case 'tool.start':
        setToolCalls((prev) => [...prev, {
          toolCallId: msg.payload.toolCallId,
          toolName: msg.payload.toolName,
          input: msg.payload.input,
          output: '',
          duration: 0,
          status: 'running',
        }])
        break

      case 'tool.progress':
        setToolCalls((prev) => prev.map((t) =>
          t.toolCallId === msg.payload.toolCallId
            ? { ...t, output: t.output + msg.payload.output }
            : t
        ))
        break

      case 'tool.end':
        setToolCalls((prev) => prev.map((t) =>
          t.toolCallId === msg.payload.toolCallId
            ? { ...t, output: msg.payload.output, duration: msg.payload.duration, status: msg.payload.status }
            : t
        ))
        break

      case 'status.update':
        setStatus(msg.payload)
        break

      case 'session.list':
        setSessions(msg.payload.sessions)
        break
    }
  }

  const send = (type: string, payload: unknown) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      type,
      id: crypto.randomUUID(),
      sessionId: props.sessionId,
      ts: Date.now(),
      payload,
    }))
  }

  const createSession = (model?: string) => send('session.create', { model })
  const sendMessage = (content: string) => send('message.send', { content })
  const cancelMessage = () => send('message.cancel', {})
  const switchSession = (sessionId: string) => send('session.switch', { sessionId })
  const switchModel = (modelId: string) => send('model.switch', { modelId })

  connect()

  onCleanup(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
  })

  const value: AgentContextValue = {
    get connected() { return connected() },
    sessionId: props.sessionId,
    get messages() { return messages() },
    get toolCalls() { return toolCalls() },
    sessions: sessions(),
    status,
    send,
    createSession,
    sendMessage,
    cancelMessage,
    switchSession,
    switchModel,
  }

  return (
    <AgentContext.Provider value={value}>
      {props.children}
    </AgentContext.Provider>
  )
}

// ========== Hook ==========

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgent must be used within AgentProvider')
  return ctx
}
```

- [ ] **Step 2: Verify TypeScript**

The protocol types are imported from `../../../bridge/protocol`. The path alias in `tsconfig.json` doesn't cover this. Add a path mapping:

Edit `frontend/tsconfig.json` — add to `compilerOptions.paths`:
```json
"@bridge/*": ["../bridge/*"]
```

Or just use a relative import that TypeScript resolves. Actually, the cleaner approach: copy `protocol.ts` into frontend as a shared file, or use a symlink. Let's keep it simple — have the frontend import directly with a relative path. The path is `../../bridge/protocol` from `useAgent.tsx`.

Actually, the import path from `frontend/src/shell/useAgent.tsx` to `bridge/protocol.ts` would be `../../../bridge/protocol`. But this is outside the frontend directory. Let me add the bridge path to the tsconfig `include` or `paths`.

Let's update the tsconfig to include the path:

```json
"paths": {
  "@/*": ["./src/*"],
  "@bridge/*": ["../bridge/*"]
}
```

Wait, `../bridge/*` from the frontend directory. That should work. But the paths alias resolution with Vite might be tricky. Let me just use a simple approach: duplicate the minimal types needed in the frontend, or add the path to vite.config.ts resolve alias.

Actually, the simplest approach for now: add the bridge path in both tsconfig and vite config. Let me include that in this step.

- [ ] **Step 2: Update frontend/tsconfig.json paths**

Read the existing tsconfig.json and add the bridge path:

```json
"paths": {
  "@/*": ["./src/*"],
  "@bridge/*": ["../bridge/*"]
}
```

- [ ] **Step 3: Update frontend/vite.config.ts resolve alias**

```ts
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { resolve } from 'path'

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@bridge': resolve(__dirname, '../bridge'),
    },
  },
})
```

- [ ] **Step 4: Rewrite useAgent.tsx imports using @bridge alias**

Change the protocol import to:
```ts
import type { ServerMessage, StatusPayload, SessionInfo } from '@bridge/protocol'
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend && npm run check
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shell/useAgent.tsx frontend/tsconfig.json frontend/vite.config.ts
git commit -m "feat: WebSocket hook useAgent + AgentProvider"
```

---

## Phase 4: Core Extensions

### Task 7: SessionPanel extension

**Files:**
- Create: `frontend/src/extensions/session-panel/SessionPanel.tsx`
- Create: `frontend/src/extensions/session-panel/index.ts`

- [ ] **Step 1: Create SessionPanel.tsx**

`frontend/src/extensions/session-panel/SessionPanel.tsx`:
```tsx
import { createSignal, For, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function SessionPanel() {
  const { sessions, switchSession, sessionId, createSession } = useAgent()
  const [expanded, setExpanded] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal('')

  const filtered = () => {
    const q = searchQuery().toLowerCase()
    if (!q) return sessions
    return sessions.filter((s) => s.title.toLowerCase().includes(q) || s.id.includes(q))
  }

  const visible = () => filtered().slice(0, 3)
  const currentSession = () => sessions.find((s) => s.id === sessionId)

  return (
    <div class="p-3">
      {/* Header — always visible */}
      <div
        class="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded())}
      >
        <div class="flex items-center gap-2">
          <span class="text-xs text-[var(--text-secondary)]">💬</span>
          <span class="text-sm font-medium">{currentSession()?.title ?? '会话'}</span>
          <span class="text-xs text-[var(--text-secondary)]">
            {currentSession()?.roundCount ?? 0} 轮
          </span>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] w-5 h-5 flex items-center justify-center rounded"
            onClick={(e) => { e.stopPropagation(); createSession() }}
          >
            +
          </button>
          <span class="text-xs text-[var(--text-secondary)] transform transition-transform"
            classList={{ 'rotate-90': expanded() }}
          >
            ▶
          </span>
        </div>
      </div>

      {/* Expanded sub-session list */}
      <Show when={expanded()}>
        <div class="mt-3">
          <input
            type="text"
            placeholder="搜索会话..."
            class="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none mb-2"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <div class="max-h-40 overflow-y-auto space-y-1">
            <For each={visible()}>
              {(s) => (
                <div
                  class="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors"
                  classList={{
                    'bg-[var(--accent)]/15 text-[var(--accent)]': s.id === sessionId,
                    'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]': s.id !== sessionId,
                  }}
                  onClick={() => switchSession(s.id)}
                >
                  <span>💬</span>
                  <span class="truncate flex-1">{s.title}</span>
                  <span class="text-[var(--text-secondary)]">{s.roundCount}轮</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
```

- [ ] **Step 2: Create index.ts registration**

`frontend/src/extensions/session-panel/index.ts`:
```ts
import { registry } from '@/registry'
import { SessionPanel } from './SessionPanel'

registry.register({
  id: 'session-panel',
  slot: 'left-top',
  component: SessionPanel,
})
```

- [ ] **Step 3: Import extension in index.tsx**

Add to `frontend/src/index.tsx` (after the App import):
```ts
import './extensions/session-panel'
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && npm run check
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/extensions/session-panel/ frontend/src/index.tsx
git commit -m "feat: 会话面板扩展 SessionPanel"
```

---

### Task 8: ToolPanel extension

**Files:**
- Create: `frontend/src/extensions/tool-panel/ToolPanel.tsx`
- Create: `frontend/src/extensions/tool-panel/index.ts`

- [ ] **Step 1: Create ToolPanel.tsx**

`frontend/src/extensions/tool-panel/ToolPanel.tsx`:
```tsx
import { createSignal, For, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import type { ToolCallEntry } from '@/shell/useAgent'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function ToolEntry(props: { tool: ToolCallEntry }) {
  const [expanded, setExpanded] = createSignal(false)

  const statusIcon = () => {
    if (props.tool.status === 'running') return '◉'
    if (props.tool.status === 'error') return '✕'
    return '✓'
  }

  const statusColor = () => {
    if (props.tool.status === 'running') return 'text-yellow-400'
    if (props.tool.status === 'error') return 'text-red-400'
    return 'text-green-400'
  }

  return (
    <div class="glass rounded-lg mb-1.5 overflow-hidden">
      <div
        class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
        classList={{ 'animate-pulse': props.tool.status === 'running' }}
        onClick={() => setExpanded(!expanded())}
      >
        <span class={statusColor() + ' text-xs'}>{statusIcon()}</span>
        <span class="text-xs font-medium flex-1">{props.tool.toolName}</span>
        <span class="text-xs text-[var(--text-secondary)]">
          {props.tool.status === 'running' ? '...' : formatDuration(props.tool.duration)}
        </span>
      </div>
      <Show when={expanded()}>
        <div class="px-3 pb-3">
          <pre class="text-xs text-[var(--text-secondary)] font-mono bg-black/30 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap">
            {props.tool.output || '(等待输出...)'}
          </pre>
        </div>
      </Show>
    </div>
  )
}

export function ToolPanel() {
  const { toolCalls } = useAgent()

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-green-400" />
          <span class="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            工具执行
          </span>
        </div>
        <span class="text-xs text-[var(--text-secondary)]">{toolCalls.length}</span>
      </div>
      <div class="flex-1 overflow-y-auto p-2">
        <Show
          when={toolCalls.length > 0}
          fallback={
            <div class="text-xs text-[var(--text-secondary)] text-center mt-8">
              暂无工具调用
            </div>
          }
        >
          <For each={toolCalls}>
            {(tool) => <ToolEntry tool={tool} />}
          </For>
        </Show>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create index.ts registration**

`frontend/src/extensions/tool-panel/index.ts`:
```ts
import { registry } from '@/registry'
import { ToolPanel } from './ToolPanel'

registry.register({
  id: 'tool-panel',
  slot: 'left-middle',
  component: ToolPanel,
})
```

- [ ] **Step 3: Import in index.tsx**

Add to `frontend/src/index.tsx`:
```ts
import './extensions/tool-panel'
```

- [ ] **Step 4: Verify TypeScript and commit**

```bash
cd frontend && npm run check
```

Expected: No errors.

```bash
git add frontend/src/extensions/tool-panel/ frontend/src/index.tsx
git commit -m "feat: 工具面板扩展 ToolPanel"
```

---

### Task 9: StatusBar extension

**Files:**
- Create: `frontend/src/extensions/status-bar/StatusBar.tsx`
- Create: `frontend/src/extensions/status-bar/index.ts`

- [ ] **Step 1: Create StatusBar.tsx**

`frontend/src/extensions/status-bar/StatusBar.tsx`:
```tsx
import { createSignal, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatCost(tokens: number): string {
  // Rough estimate: ¥0.001 per 1K tokens
  return `¥${((tokens / 1000) * 0.001).toFixed(4)}`
}

export function StatusBar() {
  const { status } = useAgent()
  const [time, setTime] = createSignal(new Date())

  const timer = setInterval(() => setTime(new Date()), 1000)
  onCleanup(() => clearInterval(timer))

  const contextPercent = () => {
    if (status.contextMax === 0) return 0
    return Math.round((status.contextUsed / status.contextMax) * 100)
  }

  const barColor = () => {
    const p = contextPercent()
    if (p > 80) return 'bg-red-500'
    if (p > 60) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div class="p-3 space-y-2 text-xs">
      {/* Row 1: Clock + model select */}
      <div class="flex items-center justify-between">
        <span class="font-mono text-base text-[var(--text-primary)] tabular-nums tracking-wider">
          {formatTime(time())}
        </span>
        <select class="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none">
          <option>deepseek-v3</option>
          <option>deepseek-r1</option>
        </select>
      </div>

      {/* Row 2: Token + cost */}
      <div class="flex items-center justify-between text-[var(--text-secondary)]">
        <span>Token: {status.tokens.toLocaleString()}</span>
        <span>{formatCost(status.tokens)}</span>
      </div>

      {/* Row 3: Context bar */}
      <div class="space-y-1">
        <div class="flex items-center justify-between text-[var(--text-secondary)]">
          <span>上下文 {contextPercent()}%</span>
          <span>第 {status.roundCount} 轮</span>
        </div>
        <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full transition-all duration-500 ${barColor()}`}
            style={{ width: `${contextPercent()}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create index.ts**

`frontend/src/extensions/status-bar/index.ts`:
```ts
import { registry } from '@/registry'
import { StatusBar } from './StatusBar'

registry.register({
  id: 'status-bar',
  slot: 'left-bottom',
  component: StatusBar,
})
```

- [ ] **Step 3: Import in index.tsx**

```ts
import './extensions/status-bar'
```

- [ ] **Step 4: Verify and commit**

```bash
cd frontend && npm run check && git add frontend/src/extensions/status-bar/ frontend/src/index.tsx && git commit -m "feat: 状态栏扩展 StatusBar"
```

---

### Task 10: ChatPanel extension (messages + input)

**Files:**
- Create: `frontend/src/extensions/chat-renderer/ChatRenderer.tsx`
- Create: `frontend/src/extensions/chat-renderer/index.ts`
- Create: `frontend/src/extensions/chat-input/ChatInput.tsx`
- Create: `frontend/src/extensions/chat-input/index.ts`

The ChatPanel spans the entire center slot. It's split into two extensions: `chat-renderer` (message list) and `chat-input` (input area). They share state via `useAgent()`.

- [ ] **Step 1: Create ChatRenderer.tsx**

`frontend/src/extensions/chat-renderer/ChatRenderer.tsx`:
```tsx
import { For, createEffect } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function ChatRenderer() {
  const { messages } = useAgent()
  let scrollRef!: HTMLDivElement

  createEffect(() => {
    // Auto-scroll on new messages
    messages()
    if (scrollRef) {
      scrollRef.scrollTop = scrollRef.scrollHeight
    }
  })

  return (
    <div class="flex-1 overflow-y-auto px-5 py-4" ref={scrollRef}>
      <For each={messages}>
        {(msg) => (
          <div
            class="flex gap-3 mb-5 message-enter"
            classList={{ 'flex-row-reverse': msg.role === 'user' }}
          >
            <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/10">
              <div
                class="w-full h-full flex items-center justify-center text-xs"
                classList={{
                  'bg-[var(--accent)]': msg.role === 'assistant',
                  'bg-white/20': msg.role === 'user',
                }}
              >
                {msg.role === 'assistant' ? 'M' : '你'}
              </div>
            </div>
            <div
              class="max-w-[80%]"
              classList={{
                'flex flex-col items-end': msg.role === 'user',
              }}
            >
              <div class="text-xs text-[var(--text-secondary)] mb-1">
                {msg.role === 'assistant' ? 'Mio' : '你'}
              </div>
              <div
                class="px-3 py-2.5 rounded-2xl text-sm leading-relaxed"
                classList={{
                  'bg-[var(--accent)]/15 border border-[var(--accent)]/20': msg.role === 'user',
                  'bg-black/35 border border-white/5': msg.role === 'assistant',
                }}
              >
                {msg.content || (msg.partial ? '...' : '')}
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
```

- [ ] **Step 2: Create chat-renderer/index.ts**

`frontend/src/extensions/chat-renderer/index.ts`:
```ts
import { registry } from '@/registry'
import { ChatRenderer } from './ChatRenderer'

registry.register({
  id: 'chat-renderer',
  slot: 'center',
  component: ChatRenderer,
})
```

- [ ] **Step 3: Create ChatInput.tsx**

`frontend/src/extensions/chat-input/ChatInput.tsx`:
```tsx
import { createSignal } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function ChatInput() {
  const { sendMessage, cancelMessage } = useAgent()
  const [content, setContent] = createSignal('')
  let textareaRef!: HTMLTextAreaElement

  const handleSend = () => {
    const text = content().trim()
    if (!text) return
    sendMessage(text)
    setContent('')
    if (textareaRef) {
      textareaRef.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <div class="px-5 pb-5 flex-shrink-0">
      <div class="glass rounded-2xl flex items-end gap-2.5 px-3.5 py-2.5">
        <textarea
          ref={textareaRef}
          rows="1"
          placeholder="给 Mio 发送消息..."
          class="flex-1 bg-transparent border-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none outline-none leading-relaxed max-h-[120px] min-h-[20px]"
          style={{ 'font-family': 'inherit' }}
          value={content()}
          onInput={(e) => { setContent(e.currentTarget.value); handleInput() }}
          onKeyDown={handleKeyDown}
        />
        <button
          class="w-8 h-8 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center hover:opacity-85 transition-opacity flex-shrink-0"
          onClick={handleSend}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create chat-input/index.ts**

`frontend/src/extensions/chat-input/index.ts`:
```ts
import { registry } from '@/registry'
import { ChatInput } from './ChatInput'

registry.register({
  id: 'chat-input',
  slot: 'center',
  component: ChatInput,
})
```

- [ ] **Step 5: Import in index.tsx**

```ts
import './extensions/chat-renderer'
import './extensions/chat-input'
```

- [ ] **Step 6: Update App.tsx**

The center slot currently holds two extensions but there's only one slot div. We need the center to stack the message list and input vertically. Update the center slot in `App.tsx` to be a flex column:

The center slot div already has `flex flex-col` classes. Multiple extensions in the same slot need to render in order. Update `slot-center` rendering:

```tsx
<div class="glass slot-center rounded-lg overflow-hidden flex flex-col">
  {registry.getBySlot('center')}
</div>
```

This already renders all center-slot extensions. They'll stack vertically because the parent is `flex flex-col`.

- [ ] **Step 7: Verify and commit**

```bash
cd frontend && npm run check && git add frontend/src/extensions/chat-renderer/ frontend/src/extensions/chat-input/ frontend/src/index.tsx && git commit -m "feat: 对话面板 ChatRenderer + ChatInput"
```

---

### Task 11: RightPanel extensions (FileTree, DocPreview, MemoryView)

**Files:**
- Create: `frontend/src/extensions/right-panel/RightPanelTabs.tsx`
- Create: `frontend/src/extensions/right-panel/index.ts`
- Create: `frontend/src/extensions/file-tree/FileTree.tsx`
- Create: `frontend/src/extensions/file-tree/index.ts`
- Create: `frontend/src/extensions/doc-preview/DocPreview.tsx`
- Create: `frontend/src/extensions/doc-preview/index.ts`
- Create: `frontend/src/extensions/memory-view/MemoryView.tsx`
- Create: `frontend/src/extensions/memory-view/index.ts`

- [ ] **Step 1: Create RightPanelTabs.tsx**

`frontend/src/extensions/right-panel/RightPanelTabs.tsx`:
```tsx
import { createSignal, Switch, Match } from 'solid-js'
import { FileTree } from '@/extensions/file-tree/FileTree'
import { DocPreview } from '@/extensions/doc-preview/DocPreview'
import { MemoryView } from '@/extensions/memory-view/MemoryView'

type TabId = 'file' | 'preview' | 'memory'

const TABS: { id: TabId; label: string }[] = [
  { id: 'file', label: '文件' },
  { id: 'preview', label: '预览' },
  { id: 'memory', label: '记忆' },
]

export function RightPanelTabs() {
  const [activeTab, setActiveTab] = createSignal<TabId>('file')

  return (
    <div class="flex flex-col h-full">
      <div class="tab-bar">
        {TABS.map((tab) => (
          <button
            class="tab-btn"
            classList={{ active: activeTab() === tab.id }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div class="flex-1 overflow-y-auto">
        <Switch>
          <Match when={activeTab() === 'file'}>
            <FileTree />
          </Match>
          <Match when={activeTab() === 'preview'}>
            <DocPreview />
          </Match>
          <Match when={activeTab() === 'memory'}>
            <MemoryView />
          </Match>
        </Switch>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create right-panel/index.ts**

`frontend/src/extensions/right-panel/index.ts`:
```ts
import { registry } from '@/registry'
import { RightPanelTabs } from './RightPanelTabs'

registry.register({
  id: 'right-panel',
  slot: 'right',
  label: '面板',
  component: RightPanelTabs,
})
```

- [ ] **Step 3: Create FileTree.tsx**

`frontend/src/extensions/file-tree/FileTree.tsx`:
```tsx
import { createSignal, For, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

interface TreeNode {
  name: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

export function FileTree() {
  const { send } = useAgent()
  const [tree, setTree] = createSignal<TreeNode[]>([
    { name: 'project', type: 'directory', children: [
      { name: 'main.ts', type: 'file' },
      { name: 'config.json', type: 'file' },
    ]},
    { name: 'docs', type: 'directory', children: [
      { name: 'readme.md', type: 'file' },
    ]},
  ])

  const handleClick = (node: TreeNode) => {
    if (node.type === 'file') {
      send('file.read', { path: node.name })
    }
  }

  const renderNode = (node: TreeNode, depth: number) => {
    const [expanded, setExpanded] = createSignal(false)
    const icon = node.type === 'directory' ? (expanded() ? '📂' : '📁') : '📄'

    return (
      <>
        <div
          class="flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer hover:bg-white/5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          style={{ 'padding-left': `${depth * 14 + 6}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              setExpanded(!expanded())
            } else {
              handleClick(node)
            }
          }}
        >
          <span class="text-xs">{icon}</span>
          <span class="truncate">{node.name}</span>
        </div>
        <Show when={node.type === 'directory' && expanded() && node.children}>
          <For each={node.children!}>
            {(child) => renderNode(child, depth + 1)}
          </For>
        </Show>
      </>
    )
  }

  return (
    <div class="p-2">
      <For each={tree()}>
        {(node) => renderNode(node, 0)}
      </For>
    </div>
  )
}
```

- [ ] **Step 4: Create file-tree/index.ts**

`frontend/src/extensions/file-tree/index.ts`:
```ts
import { registry } from '@/registry'
import { FileTree } from './FileTree'

registry.register({
  id: 'file-tree',
  slot: 'right',
  component: FileTree,
})
```

Wait — this conflicts with the right-panel registration. The RightPanelTabs already handles tabs. FileTree, DocPreview, and MemoryView are sub-components, not independently registered extensions. Let me reconsider the architecture.

The RightPanelTabs is the single extension for the `right` slot. FileTree, DocPreview, MemoryView are internal sub-components of RightPanelTabs. They don't register independently. Let me fix the plan.

**Correction:** Only `RightPanelTabs` registers for slot `right`. FileTree, DocPreview, MemoryView are just components imported by RightPanelTabs — they don't have their own `index.ts` registration files.

Remove the separate file-tree/index.ts, doc-preview/index.ts, memory-view/index.ts. They're just component files.

- [ ] **Step 1 (revised): Create FileTree.tsx**

Same as above but no registration file.

- [ ] **Step 2 (revised): Create DocPreview.tsx**

`frontend/src/extensions/doc-preview/DocPreview.tsx`:
```tsx
import { createSignal } from 'solid-js'

export function DocPreview() {
  const [viewMode, setViewMode] = createSignal<'preview' | 'source'>('preview')
  const [content, setContent] = createSignal('')
  const [filePath, setFilePath] = createSignal('')

  return (
    <div class="p-3">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-[var(--text-secondary)] truncate flex-1">
          {filePath() || '选择文件以预览'}
        </span>
        <div class="flex gap-1">
          <button
            class="text-xs px-2 py-0.5 rounded"
            classList={{
              'bg-[var(--accent)]/20 text-[var(--accent)]': viewMode() === 'preview',
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)]': viewMode() !== 'preview',
            }}
            onClick={() => setViewMode('preview')}
          >
            预览
          </button>
          <button
            class="text-xs px-2 py-0.5 rounded"
            classList={{
              'bg-[var(--accent)]/20 text-[var(--accent)]': viewMode() === 'source',
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)]': viewMode() !== 'source',
            }}
            onClick={() => setViewMode('source')}
          >
            源码
          </button>
        </div>
      </div>
      <div class="bg-black/30 rounded-lg p-3 min-h-[120px]">
        {content() ? (
          <pre class="text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap">
            {content()}
          </pre>
        ) : (
          <div class="text-xs text-[var(--text-secondary)] text-center">
            点击左侧文件树中的文件查看内容
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3 (revised): Create MemoryView.tsx**

`frontend/src/extensions/memory-view/MemoryView.tsx`:
```tsx
import { createSignal, For } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function MemoryView() {
  const { send } = useAgent()
  const [query, setQuery] = createSignal('')
  const [memories, setMemories] = createSignal<Array<{ content: string; category: string; importance: number }>>([])

  const handleSearch = () => {
    const q = query().trim()
    if (!q) return
    send('memory.search', { query: q })
  }

  return (
    <div class="p-3">
      <div class="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="搜索记忆..."
          class="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          class="px-2 py-1 bg-[var(--accent)]/20 text-[var(--accent)] rounded text-xs hover:bg-[var(--accent)]/30 transition-colors"
          onClick={handleSearch}
        >
          搜索
        </button>
      </div>
      <div class="space-y-2">
        <For each={memories()}>
          {(mem) => (
            <div class="glass rounded-lg p-2.5 text-xs">
              <div class="text-[var(--text-primary)] leading-relaxed mb-1">{mem.content}</div>
              <div class="flex items-center justify-between text-[var(--text-secondary)]">
                <span>{mem.category}</span>
                <span>重要性: {mem.importance}</span>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create right-panel/index.ts**

`frontend/src/extensions/right-panel/index.ts`:
```ts
import { registry } from '@/registry'
import { RightPanelTabs } from './RightPanelTabs'

registry.register({
  id: 'right-panel',
  slot: 'right',
  label: '面板',
  component: RightPanelTabs,
})
```

- [ ] **Step 5: Import in index.tsx**

```ts
import './extensions/right-panel'
```

- [ ] **Step 6: Verify and commit**

```bash
cd frontend && npm run check && git add frontend/src/extensions/right-panel/ frontend/src/extensions/file-tree/ frontend/src/extensions/doc-preview/ frontend/src/extensions/memory-view/ frontend/src/index.tsx && git commit -m "feat: 右侧面板 RightPanel + FileTree + DocPreview + MemoryView"
```

---

## Phase 5: Bridge Server

### Task 12: Bridge server entry point + WebSocket server

**Files:**
- Create: `bridge/index.ts`

- [ ] **Step 1: Create index.ts**

`bridge/index.ts`:
```ts
import { WebSocketServer, WebSocket } from 'ws'
import { dispatch } from './dispatcher'

const PORT = 9229

const wss = new WebSocketServer({ port: PORT })

console.log(`[bridge] WebSocket server listening on ws://localhost:${PORT}`)

wss.on('connection', (ws: WebSocket) => {
  console.log('[bridge] client connected')

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      dispatch(msg, ws)
    } catch (err) {
      console.error('[bridge] failed to parse message:', err)
      ws.send(JSON.stringify({
        type: 'error',
        id: 'err-parse',
        sessionId: '',
        ts: Date.now(),
        payload: { code: 'PARSE_ERROR', message: 'Invalid JSON', recoverable: true },
      }))
    }
  })

  ws.on('close', () => {
    console.log('[bridge] client disconnected')
  })

  ws.on('error', (err) => {
    console.error('[bridge] ws error:', err)
  })
})
```

- [ ] **Step 2: Create dispatcher.ts**

`bridge/dispatcher.ts`:
```ts
import type { WebSocket } from 'ws'
import type { ClientMessage } from './protocol'
import { handleSessionCreate, handleSessionList, handleSessionSwitch, handleSessionDelete } from './handlers/session'
import { handleMessageSend, handleMessageCancel } from './handlers/message'
import { handleModelSwitch, handleModelList } from './handlers/model'
import { handleFileList, handleFileRead } from './handlers/file'
import { handleMemorySearch, handleMemoryList } from './handlers/memory'

type Handler = (msg: ClientMessage, ws: WebSocket) => void | Promise<void>

const routes: Record<string, Handler> = {
  'session.create': handleSessionCreate,
  'session.list': handleSessionList,
  'session.switch': handleSessionSwitch,
  'session.delete': handleSessionDelete,
  'message.send': handleMessageSend,
  'message.cancel': handleMessageCancel,
  'model.switch': handleModelSwitch,
  'model.list': handleModelList,
  'file.list': handleFileList,
  'file.read': handleFileRead,
  'memory.search': handleMemorySearch,
  'memory.list': handleMemoryList,
}

export function dispatch(msg: ClientMessage, ws: WebSocket): void {
  const handler = routes[msg.type]
  if (!handler) {
    ws.send(JSON.stringify({
      type: 'error',
      id: msg.id,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'UNKNOWN_TYPE', message: `Unknown message type: ${msg.type}`, recoverable: true },
    }))
    return
  }
  handler(msg, ws)
}
```

- [ ] **Step 3: Create handlers/index.ts (barrel export)**

`bridge/handlers/index.ts`:
```ts
// Barrel re-export — all handler registration is in dispatcher.ts
```

- [ ] **Step 4: Verify TypeScript compiles (will fail as handlers not yet created)**

```bash
cd bridge && npx tsc --noEmit
```

This will fail because handler files don't exist yet. That's expected — we create them in the next tasks.

- [ ] **Step 5: Commit**

```bash
git add bridge/index.ts bridge/dispatcher.ts bridge/handlers/index.ts
git commit -m "feat: 桥接服务器入口 + 消息路由"
```

---

### Task 13: Session handler

**Files:**
- Create: `bridge/handlers/session.ts`

- [ ] **Step 1: Create session.ts**

`bridge/handlers/session.ts`:
```ts
import type { WebSocket } from 'ws'
import type { ClientMessage, SessionInfo } from '../protocol'

// In-memory session store (will be replaced by Pi SDK integration)
const sessions = new Map<string, { id: string; title: string; createdAt: number; model: string }>()

export function handleSessionCreate(msg: ClientMessage<'session.create'>, ws: WebSocket): void {
  const sessionId = msg.sessionId || `sess-${Date.now()}`
  const model = msg.payload.model ?? 'deepseek-v3'

  sessions.set(sessionId, {
    id: sessionId,
    title: `新会话 ${new Date().toLocaleDateString('zh-CN')}`,
    createdAt: Date.now(),
    model,
  })

  ws.send(JSON.stringify({
    type: 'session.created',
    id: `srv-${Date.now()}`,
    sessionId,
    ts: Date.now(),
    payload: { sessionId, model, thinkingLevel: 'medium', createdAt: Date.now() },
  }))
}

export function handleSessionList(_msg: ClientMessage<'session.list'>, ws: WebSocket): void {
  const list: SessionInfo[] = Array.from(sessions.values()).map((s) => ({
    id: s.id,
    title: s.title,
    lastActive: Date.now(),
    roundCount: 0,
  }))

  ws.send(JSON.stringify({
    type: 'session.list',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { sessions: list },
  }))
}

export function handleSessionSwitch(msg: ClientMessage<'session.switch'>, ws: WebSocket): void {
  const session = sessions.get(msg.payload.sessionId)
  ws.send(JSON.stringify({
    type: 'session.state',
    id: `srv-${Date.now()}`,
    sessionId: msg.payload.sessionId,
    ts: Date.now(),
    payload: {
      model: session?.model ?? 'deepseek-v3',
      thinkingLevel: 'medium',
      contextUsed: 0,
      roundCount: 0,
    },
  }))
}

export function handleSessionDelete(msg: ClientMessage<'session.delete'>, ws: WebSocket): void {
  sessions.delete(msg.payload.sessionId)
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd bridge && npx tsc --noEmit
```

Expected: No errors now that session.ts exists.

- [ ] **Step 3: Commit**

```bash
git add bridge/handlers/session.ts && git commit -m "feat: 会话 handler"
```

---

### Task 14: Message handler

**Files:**
- Create: `bridge/handlers/message.ts`

- [ ] **Step 1: Create message.ts (stub — full Pi integration later)**

`bridge/handlers/message.ts`:
```ts
import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'

export async function handleMessageSend(msg: ClientMessage<'message.send'>, ws: WebSocket): Promise<void> {
  const turnIndex = Date.now()
  const messageId = `msg-${turnIndex}`

  ws.send(JSON.stringify({
    type: 'turn.start',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { turnIndex },
  }))

  ws.send(JSON.stringify({
    type: 'message.start',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { messageId, role: 'assistant' },
  }))

  // Simulate streaming response (replace with Pi SDK integration)
  const response = `收到你的消息：「${msg.payload.content}」\n\n这是桥接服务器的模拟回复。后续将接入 Pi SDK 实现真正的 AI 对话。`
  let pos = 0
  const chunkSize = 3

  const interval = setInterval(() => {
    if (pos >= response.length) {
      clearInterval(interval)

      ws.send(JSON.stringify({
        type: 'message.end',
        id: `srv-${Date.now()}`,
        sessionId: msg.sessionId,
        ts: Date.now(),
        payload: { messageId, content: response, usage: { input: 50, output: response.length, total: 50 + response.length } },
      }))

      ws.send(JSON.stringify({
        type: 'turn.end',
        id: `srv-${Date.now()}`,
        sessionId: msg.sessionId,
        ts: Date.now(),
        payload: { turnIndex, usage: { input: 50, output: response.length, total: 50 + response.length }, cost: 0.001 },
      }))

      ws.send(JSON.stringify({
        type: 'status.update',
        id: `srv-${Date.now()}`,
        sessionId: msg.sessionId,
        ts: Date.now(),
        payload: { tokens: 300 + response.length, cost: 0.004, contextUsed: 1200, contextMax: 128000, roundCount: 3 },
      }))

      return
    }

    const delta = response.slice(pos, pos + chunkSize)
    pos += chunkSize

    ws.send(JSON.stringify({
      type: 'message.delta',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { messageId, delta },
    }))

    // Simulate tool call mid-stream
    if (pos === 30) {
      const toolId = `tool-${Date.now()}`
      ws.send(JSON.stringify({
        type: 'tool.start',
        id: `srv-${Date.now()}`,
        sessionId: msg.sessionId,
        ts: Date.now(),
        payload: { toolCallId: toolId, toolName: 'read', input: { path: 'CLAUDE.md' } },
      }))

      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'tool.end',
          id: `srv-${Date.now()}`,
          sessionId: msg.sessionId,
          ts: Date.now(),
          payload: { toolCallId: toolId, toolName: 'read', output: '# 澪号 Personal Agent\n...', duration: 142, status: 'success' },
        }))
      }, 500)
    }
  }, 50)
}

export function handleMessageCancel(_msg: ClientMessage<'message.cancel'>, ws: WebSocket): void {
  ws.send(JSON.stringify({
    type: 'error',
    id: `srv-${Date.now()}`,
    sessionId: _msg.sessionId,
    ts: Date.now(),
    payload: { code: 'CANCEL_NOT_IMPLEMENTED', message: 'Cancel not yet supported', recoverable: true },
  }))
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd bridge && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add bridge/handlers/message.ts && git commit -m "feat: 消息 handler（模拟流式回复）"
```

---

### Task 15: Model, File, Memory handlers

**Files:**
- Create: `bridge/handlers/model.ts`
- Create: `bridge/handlers/file.ts`
- Create: `bridge/handlers/memory.ts`

- [ ] **Step 1: Create model.ts**

`bridge/handlers/model.ts`:
```ts
import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'

const MODELS = ['deepseek-v3', 'deepseek-r1', 'deepseek-v4-pro']

export function handleModelSwitch(msg: ClientMessage<'model.switch'>, ws: WebSocket): void {
  ws.send(JSON.stringify({
    type: 'session.state',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { model: msg.payload.modelId, thinkingLevel: 'medium', contextUsed: 0, roundCount: 0 },
  }))
}

export function handleModelList(_msg: ClientMessage<'model.list'>, ws: WebSocket): void {
  // Use 'status.update' or a custom response — the protocol doesn't have model.list response type,
  // but the frontend model select reads from local state. Kept as no-op for now.
  console.log('[bridge] available models:', MODELS.join(', '))
}
```

- [ ] **Step 2: Create file.ts**

`bridge/handlers/file.ts`:
```ts
import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { readdirSync, statSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

export function handleFileList(msg: ClientMessage<'file.list'>, ws: WebSocket): void {
  const targetPath = msg.payload.path ?? '.'
  try {
    const entries = readdirSync(targetPath).map((name) => {
      const fullPath = join(targetPath, name)
      const s = statSync(fullPath)
      return {
        name,
        type: s.isDirectory() ? 'directory' as const : 'file' as const,
        size: s.isFile() ? s.size : undefined,
      }
    })

    ws.send(JSON.stringify({
      type: 'file.list',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { path: targetPath, entries },
    }))
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'FILE_ERROR', message: String(err), recoverable: true },
    }))
  }
}

export function handleFileRead(msg: ClientMessage<'file.read'>, ws: WebSocket): void {
  try {
    if (!existsSync(msg.payload.path)) {
      throw new Error(`File not found: ${msg.payload.path}`)
    }
    const content = readFileSync(msg.payload.path, 'utf-8')
    const ext = msg.payload.path.split('.').pop() ?? ''

    ws.send(JSON.stringify({
      type: 'file.content',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { path: msg.payload.path, content, language: ext },
    }))
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'FILE_ERROR', message: String(err), recoverable: true },
    }))
  }
}
```

- [ ] **Step 3: Create memory.ts**

`bridge/handlers/memory.ts`:
```ts
import type { WebSocket } from 'ws'
import type { ClientMessage, MemoryEntry } from '../protocol'

const memories: MemoryEntry[] = [
  { content: '用户偏好 TypeScript 严格模式', category: 'preference', importance: 8 },
  { content: '项目使用 Pi 框架作为后端', category: 'technical', importance: 9 },
  { content: 'UI 风格：玻璃拟态 + 悬浮面板', category: 'design', importance: 7 },
]

export function handleMemorySearch(msg: ClientMessage<'memory.search'>, ws: WebSocket): void {
  const query = msg.payload.query.toLowerCase()
  const results = memories.filter((m) => m.content.toLowerCase().includes(query))

  ws.send(JSON.stringify({
    type: 'memory.results',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { query: msg.payload.query, entries: results },
  }))
}

export function handleMemoryList(msg: ClientMessage<'memory.list'>, ws: WebSocket): void {
  const limit = msg.payload.limit ?? 20
  const offset = msg.payload.offset ?? 0
  const slice = memories.slice(offset, offset + limit)

  ws.send(JSON.stringify({
    type: 'memory.list',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { entries: slice, total: memories.length },
  }))
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd bridge && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add bridge/handlers/model.ts bridge/handlers/file.ts bridge/handlers/memory.ts && git commit -m "feat: Model + File + Memory handler"
```

---

## Phase 6: Integration

### Task 16: Wire AgentProvider into index.tsx

**Files:**
- Modify: `frontend/src/index.tsx`

- [ ] **Step 1: Update index.tsx to wrap App in AgentProvider**

`frontend/src/index.tsx`:
```tsx
import { render } from 'solid-js/web'
import { AgentProvider } from './shell/useAgent'
import { App } from './shell/App'
import './shell/App.css'

// Import all extensions
import './extensions/session-panel'
import './extensions/tool-panel'
import './extensions/status-bar'
import './extensions/chat-renderer'
import './extensions/chat-input'
import './extensions/right-panel'

render(() => (
  <AgentProvider sessionId="sess-default">
    <App />
  </AgentProvider>
), document.getElementById('root')!)
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npm run check
```

Expected: No errors.

- [ ] **Step 3: Start both servers for end-to-end test**

Terminal 1:
```bash
cd bridge && npx tsx index.ts
```
Expected: `[bridge] WebSocket server listening on ws://localhost:9229`

Terminal 2:
```bash
cd frontend && npm run dev
```
Expected: Vite dev server at `http://localhost:5173`

- [ ] **Step 4: Test in browser**

Open `http://localhost:5173` and check:
1. Scene layer with character placeholder visible
2. Left panels (Session, Tools, Status) rendered
3. Center chat panel with input area
4. Right panel draggable with File/Preview/Memory tabs
5. Send a message → simulated streaming response appears
6. Tool panel shows simulated tool calls
7. Status bar clock updating

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.tsx && git commit -m "feat: 集成 AgentProvider + 完整扩展注册"
```

---

### Task 17: Final TypeScript check and cleanup

- [ ] **Step 1: Run full TypeScript check**

```bash
cd frontend && npm run check && cd ../bridge && npx tsc --noEmit
```

Expected: No errors in both projects.

- [ ] **Step 2: Run git status to confirm all files tracked**

```bash
cd D:/claude/personal-agent && git status
```

- [ ] **Step 3: Commit any remaining files**

```bash
git add -A && git status
```

Review staged files for anything that shouldn't be committed (`.env`, `node_modules`, `*.db`). If clean:

```bash
git commit -m "chore: final integration and cleanup"
```

---

## Post-Implementation Checklist

After all tasks complete, verify:

- [ ] `frontend/` — `npm run check` passes, `npm run dev` starts
- [ ] `bridge/` — `npx tsc --noEmit` passes, `npx tsx index.ts` starts and listens on :9229
- [ ] Browser: all 5 panels render, WS connects, simulated messages flow
- [ ] Right panel: drag resize works, auto-collapse at <120px, expand tab clickable
- [ ] Extensions: deleting an extension folder + removing its import = clean removal, nothing breaks

## Next Steps (Future Plans)

1. **Pi SDK integration** — Replace simulated message handler with actual `createAgentSession()` from `vendor/pi`
2. **File tree live data** — Wire FileTree to bridge `file.list`/`file.read` protocol
3. **Doc preview with marked/highlight.js** — Render Markdown and code in DocPreview
4. **Memory persistence** — Wire MemoryView to pa-sqlite extension
5. **Session persistence** — Save sessions to SQLite via bridge
6. **Character badge** — Add char-badge extension showing Mio's status
