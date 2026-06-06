# 前端组件库提取 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 App.css 和现有 TSX 中提取 9 个通用组件，拆分 CSS 到 18 个文件，建立组件化基础层。不改任何视觉效果。

**Architecture:** galaxy 平铺式组件目录（`components/<name>/index.tsx + index.css`），每个组件自包含。CSS 变量是唯一共享层。布局用 Tailwind class 由调用方控制，玻璃拟态皮肤用组件级 CSS。

**Tech Stack:** SolidJS + TypeScript + Tailwind CSS + CSS Variables

---

## 文件结构总览

```
frontend/src/
├── components/                    ← 9 个新文件夹，全部新建
│   ├── glass-panel/index.tsx + index.css
│   ├── glass-input/index.tsx + index.css
│   ├── icon-button/index.tsx + index.css
│   ├── badge/index.tsx + index.css
│   ├── toggle/index.tsx + index.css
│   ├── tab-bar/index.tsx + index.css
│   ├── drag-handle/index.tsx + index.css
│   ├── progress-bar/index.tsx + index.css
│   └── spinner/index.tsx + index.css
├── shell/App.css                  ← 修改：删除 ~1100 行
├── shell/App.tsx                  ← 修改：DragHandle 替换
└── extensions/                    ← 9 个扩展各添加 xxx.css import
```

---

### Task 1: GlassPanel — 玻璃拟态容器

**Files:**
- Create: `frontend/src/components/glass-panel/index.tsx`
- Create: `frontend/src/components/glass-panel/index.css`

- [ ] **Step 1: 创建 GlassPanel CSS**

写入 `frontend/src/components/glass-panel/index.css`：

```css
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
}
```

- [ ] **Step 2: 创建 GlassPanel 组件**

写入 `frontend/src/components/glass-panel/index.tsx`：

```tsx
import type { JSX } from 'solid-js'
import './index.css'

export interface GlassPanelProps {
  children: JSX.Element
  style?: string
  class?: string
}

export function GlassPanel(props: GlassPanelProps) {
  return (
    <div class="glass-panel" classList={{ [props.class ?? '']: !!props.class }} style={props.style}>
      {props.children}
    </div>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/glass-panel/
git commit -m "feat: 新增 GlassPanel 通用组件"
```

---

### Task 2: Spinner — 脉冲指示器

**Files:**
- Create: `frontend/src/components/spinner/index.tsx`
- Create: `frontend/src/components/spinner/index.css`

- [ ] **Step 1: 创建 Spinner CSS**

写入 `frontend/src/components/spinner/index.css`：

```css
.spinner-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4ade80;
  transition: background 0.3s;
}
.spinner-dot.inactive {
  background: rgba(255, 255, 255, 0.15);
}
.spinner-dot.running {
  animation: spinner-pulse 1.5s ease-in-out infinite;
  background: rgba(139, 156, 240, 0.8);
}
.spinner-dot.size-md {
  width: 8px;
  height: 8px;
}

@keyframes spinner-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

- [ ] **Step 2: 创建 Spinner 组件**

写入 `frontend/src/components/spinner/index.tsx`：

```tsx
import './index.css'

export interface SpinnerProps {
  active: boolean
  size?: 'sm' | 'md'
}

export function Spinner(props: SpinnerProps) {
  return (
    <span
      class="spinner-dot"
      classList={{
        inactive: !props.active,
        running: props.active,
        'size-md': props.size === 'md',
      }}
    />
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/spinner/
git commit -m "feat: 新增 Spinner 通用组件"
```

---

### Task 3: ProgressBar — 进度条

**Files:**
- Create: `frontend/src/components/progress-bar/index.tsx`
- Create: `frontend/src/components/progress-bar/index.css`

- [ ] **Step 1: 创建 ProgressBar CSS**

写入 `frontend/src/components/progress-bar/index.css`：

```css
.progress-bar-wrap {
  padding: 2px 16px 8px;
}
.progress-bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.progress-bar-track {
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
  transition: width 0.5s ease;
}
.progress-bar-fill.warn {
  background: #f4a236;
}
.progress-bar-fill.danger {
  background: #f87171;
}
```

- [ ] **Step 2: 创建 ProgressBar 组件**

写入 `frontend/src/components/progress-bar/index.tsx`：

```tsx
import './index.css'

export interface ProgressBarProps {
  value: number
  max: number
  showLabel?: boolean
  warnThreshold?: number
  dangerThreshold?: number
}

export function ProgressBar(props: ProgressBarProps) {
  const pct = () => Math.min(100, props.max > 0 ? (props.value / props.max) * 100 : 0)
  const level = () => {
    const danger = props.dangerThreshold ?? 80
    const warn = props.warnThreshold ?? 60
    if (pct() > danger) return 'danger'
    if (pct() > warn) return 'warn'
    return ''
  }

  return (
    <div class="progress-bar-wrap">
      {props.showLabel && (
        <div class="progress-bar-label">
          <span>上下文用量</span>
          <span>{props.value.toLocaleString()} / {props.max.toLocaleString()}</span>
        </div>
      )}
      <div class="progress-bar-track">
        <div
          class="progress-bar-fill"
          classList={{ warn: level() === 'warn', danger: level() === 'danger' }}
          style={{ width: `${pct()}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/progress-bar/
git commit -m "feat: 新增 ProgressBar 通用组件"
```

---

### Task 4: Badge — 标签/徽章

**Files:**
- Create: `frontend/src/components/badge/index.tsx`
- Create: `frontend/src/components/badge/index.css`

- [ ] **Step 1: 创建 Badge CSS**

写入 `frontend/src/components/badge/index.css`：

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 6px 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
}
.badge--default {
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.06);
}
.badge--accent {
  color: var(--accent);
  background: rgba(139, 156, 240, 0.10);
  border: 1px solid rgba(139, 156, 240, 0.15);
}
.badge--success {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
}
.badge-remove {
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}
.badge-remove:hover {
  color: #f87171;
}
```

- [ ] **Step 2: 创建 Badge 组件**

写入 `frontend/src/components/badge/index.tsx`：

```tsx
import type { JSX } from 'solid-js'
import './index.css'

export interface BadgeProps {
  children: JSX.Element
  variant?: 'default' | 'accent' | 'success'
  removable?: boolean
  onRemove?: () => void
}

export function Badge(props: BadgeProps) {
  return (
    <span class="badge" classList={{ [`badge--${props.variant ?? 'default'}`]: true }}>
      {props.children}
      {props.removable && (
        <button class="badge-remove" onClick={props.onRemove}>×</button>
      )}
    </span>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/badge/
git commit -m "feat: 新增 Badge 通用组件"
```

---

### Task 5: Toggle — 开关

**Files:**
- Create: `frontend/src/components/toggle/index.tsx`
- Create: `frontend/src/components/toggle/index.css`

- [ ] **Step 1: 创建 Toggle CSS**

写入 `frontend/src/components/toggle/index.css`：

```css
.toggle {
  width: 34px;
  height: 20px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.10);
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
  padding: 0;
}
.toggle.on {
  background: rgba(139, 156, 240, 0.35);
}
.toggle::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
}
.toggle.on::after {
  transform: translateX(14px);
}
.toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 2: 创建 Toggle 组件**

写入 `frontend/src/components/toggle/index.tsx`：

```tsx
import './index.css'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Toggle(props: ToggleProps) {
  return (
    <button
      class="toggle"
      classList={{ on: props.checked }}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      role="switch"
      aria-checked={props.checked}
    />
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/toggle/
git commit -m "feat: 新增 Toggle 通用组件"
```

---

### Task 6: IconButton — 图标按钮底座

**Files:**
- Create: `frontend/src/components/icon-button/index.tsx`
- Create: `frontend/src/components/icon-button/index.css`

- [ ] **Step 1: 创建 IconButton CSS**

写入 `frontend/src/components/icon-button/index.css`：

```css
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, transform 0.15s;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1;
}
.icon-btn:disabled {
  color: var(--text-muted);
  cursor: default;
}

/* size */
.icon-btn--sm {
  width: 28px;
  height: 28px;
  border-radius: 4px;
}
.icon-btn--md {
  width: 34px;
  height: 34px;
  border-radius: 50%;
}

/* variant */
.icon-btn--ghost:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}
.icon-btn--ghost.icon-btn--sm {
  border: 1px solid transparent;
}
.icon-btn--ghost.icon-btn--md {
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.icon-btn--accent {
  background: rgba(139, 156, 240, 0.15);
  color: var(--accent);
}
.icon-btn--accent:hover {
  background: rgba(139, 156, 240, 0.25);
}
.icon-btn--danger:hover {
  color: #f87171;
  background: rgba(248, 113, 113, 0.08);
}
```

- [ ] **Step 2: 创建 IconButton 组件**

写入 `frontend/src/components/icon-button/index.tsx`：

```tsx
import './index.css'

export interface IconButtonProps {
  icon: string
  onClick: () => void
  size?: 'sm' | 'md'
  variant?: 'ghost' | 'accent' | 'danger'
  title?: string
  disabled?: boolean
}

export function IconButton(props: IconButtonProps) {
  return (
    <button
      class="icon-btn"
      classList={{
        [`icon-btn--${props.size ?? 'md'}`]: true,
        [`icon-btn--${props.variant ?? 'ghost'}`]: true,
      }}
      onClick={props.onClick}
      title={props.title}
      disabled={props.disabled}
    >
      {props.icon}
    </button>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/icon-button/
git commit -m "feat: 新增 IconButton 通用组件"
```

---

### Task 7: GlassInput — 玻璃拟态输入框

**Files:**
- Create: `frontend/src/components/glass-input/index.tsx`
- Create: `frontend/src/components/glass-input/index.css`

- [ ] **Step 1: 创建 GlassInput CSS**

写入 `frontend/src/components/glass-input/index.css`：

```css
.glass-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 7px 10px;
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}
.glass-input:focus {
  border-color: rgba(139, 156, 240, 0.3);
}
.glass-input::placeholder {
  color: rgba(255, 255, 255, 0.20);
}
```

- [ ] **Step 2: 创建 GlassInput 组件**

写入 `frontend/src/components/glass-input/index.tsx`：

```tsx
import './index.css'

export interface GlassInputProps {
  value: string
  onInput: (value: string) => void
  placeholder?: string
  type?: 'text' | 'search'
  style?: string
}

export function GlassInput(props: GlassInputProps) {
  return (
    <input
      class="glass-input"
      type={props.type ?? 'text'}
      value={props.value}
      placeholder={props.placeholder}
      style={props.style}
      onInput={(e) => props.onInput(e.currentTarget.value)}
    />
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/glass-input/
git commit -m "feat: 新增 GlassInput 通用组件"
```

---

### Task 8: TabBar — 标签栏

**Files:**
- Create: `frontend/src/components/tab-bar/index.tsx`
- Create: `frontend/src/components/tab-bar/index.css`

- [ ] **Step 1: 创建 TabBar CSS**

写入 `frontend/src/components/tab-bar/index.css`：

```css
.tab-bar-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
}
.tab-bar-item {
  flex: 1;
  padding: 8px 0;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  text-align: center;
  cursor: pointer;
  user-select: none;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
  font-family: inherit;
}
.tab-bar-item:hover {
  color: var(--text-secondary);
}
.tab-bar-item.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}
```

- [ ] **Step 2: 创建 TabBar 组件**

写入 `frontend/src/components/tab-bar/index.tsx`：

```tsx
import { For } from 'solid-js'
import './index.css'

export interface TabBarProps {
  tabs: { id: string; label: string }[]
  activeTab: string
  onTabChange: (id: string) => void
}

export function TabBar(props: TabBarProps) {
  return (
    <div class="tab-bar-header">
      <For each={props.tabs}>
        {(tab) => (
          <button
            class="tab-bar-item"
            classList={{ active: tab.id === props.activeTab }}
            onClick={() => props.onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        )}
      </For>
    </div>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/tab-bar/
git commit -m "feat: 新增 TabBar 通用组件"
```

---

### Task 9: DragHandle — 拖拽把手

**Files:**
- Create: `frontend/src/components/drag-handle/index.tsx`
- Create: `frontend/src/components/drag-handle/index.css`

- [ ] **Step 1: 创建 DragHandle CSS**

写入 `frontend/src/components/drag-handle/index.css`：

```css
.drag-handle {
  position: absolute;
  left: -5px;
  top: 0;
  bottom: 0;
  width: 10px;
  cursor: col-resize;
  z-index: 10;
}
.drag-handle::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 45%;
  transform: translateX(-50%);
  width: 3px;
  height: 32px;
  border-radius: 2px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 0.15s;
}
.drag-handle:hover::after,
.drag-handle.dragging::after {
  opacity: 0.6;
}
```

- [ ] **Step 2: 创建 DragHandle 组件**

写入 `frontend/src/components/drag-handle/index.tsx`：

```tsx
import { onCleanup } from 'solid-js'
import './index.css'

export interface DragHandleProps {
  onDrag: (deltaX: number) => void
  onDragEnd?: () => void
  onDoubleClick?: () => void
  axis?: 'x' | 'y'
}

export function DragHandle(props: DragHandleProps) {
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const handle = e.currentTarget as HTMLElement
    handle.classList.add('dragging')
    document.body.style.userSelect = 'none'
    document.body.style.cursor =
      (props.axis ?? 'x') === 'x' ? 'col-resize' : 'row-resize'

    const onMove = (ev: MouseEvent) => {
      if ((props.axis ?? 'x') === 'x') {
        props.onDrag(startX - ev.clientX)
      } else {
        props.onDrag(startY - ev.clientY)
      }
    }

    const onUp = () => {
      handle.classList.remove('dragging')
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      props.onDragEnd?.()
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      class="drag-handle"
      onMouseDown={handleMouseDown}
      onDblClick={props.onDoubleClick}
    />
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/drag-handle/
git commit -m "feat: 新增 DragHandle 通用组件"
```

---

### Task 10: 拆分扩展 CSS — 从 App.css 分离

**Files:**
- Create: `frontend/src/extensions/chat-renderer/chat-renderer.css`
- Create: `frontend/src/extensions/session-panel/session-panel.css`
- Create: `frontend/src/extensions/tool-panel/tool-panel.css`
- Create: `frontend/src/extensions/status-bar/status-bar.css`
- Create: `frontend/src/extensions/file-tree/file-tree.css`
- Create: `frontend/src/extensions/doc-preview/doc-preview.css`
- Create: `frontend/src/extensions/right-panel/right-panel.css`
- Create: `frontend/src/extensions/top-menu/top-menu.css`
- Create: `frontend/src/extensions/settings-page/settings-page.css`
- Modify: `frontend/src/shell/App.css`

- [ ] **Step 1: 创建 chat-renderer.css**

从 App.css 提取以下选择器，写入 `frontend/src/extensions/chat-renderer/chat-renderer.css`：

```css
/* ====== 对话面板 ====== */
.chat-panel { display: flex; flex-direction: column; min-height: 0; }

.chat-header {
  padding: 10px 16px;
  font-size: 13px; font-weight: 500;
  color: var(--text-primary);
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
  display: flex; align-items: center; gap: 4px;
}
.chat-header .chat-subtitle {
  font-size: 11px; font-weight: 400;
  color: var(--text-muted);
}
.chat-header-right {
  margin-left: auto; display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--text-muted);
}
.chat-header-right .energy-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: rgba(139,156,240,0.6);
}

.chat-messages {
  flex: 1; overflow-y: auto;
  padding: 14px 16px;
  display: flex; flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.msg { display: flex; max-width: 85%; }
.msg.user { align-self: flex-end; }
.msg.assistant { align-self: flex-start; flex-direction: column; }

/* 思考过程块 */
.thinking-block { margin-bottom: 6px; }
.thinking-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(100,100,100,0.08);
  border: 1px solid rgba(100,100,100,0.12);
  border-radius: 6px; padding: 3px 10px;
  font-size: 11px; color: var(--text-muted);
  cursor: pointer; transition: background 0.15s;
}
.thinking-toggle:hover {
  background: rgba(100,100,100,0.15);
  color: var(--text-secondary);
}
.thinking-arrow { font-size: 9px; width: 10px; text-align: center; }
.thinking-label { font-weight: 500; }
.thinking-count { opacity: 0.6; }
.thinking-content {
  margin-top: 6px; padding: 10px 12px;
  background: rgba(100,100,100,0.04);
  border-left: 2px solid rgba(100,100,100,0.15);
  border-radius: 0 6px 6px 0;
  font-size: 12px; line-height: 1.5;
  color: var(--text-muted);
  white-space: pre-wrap; word-break: break-word;
  user-select: text;
}

.msg-bubble {
  padding: 10px 14px; border-radius: 12px;
  font-size: 13px; line-height: 1.6;
  color: var(--text-primary);
  user-select: text;
}
.msg.user .msg-bubble {
  background: rgba(139,156,240,0.15);
  border: 1px solid rgba(139,156,240,0.12);
  border-bottom-right-radius: 4px;
}
.msg.assistant .msg-bubble {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-bottom-left-radius: 4px;
}

/* Markdown 渲染样式 */
.msg.assistant .msg-bubble h1 { font-size: 18px; margin: 12px 0 6px; font-weight: 600; }
.msg.assistant .msg-bubble h2 { font-size: 15px; margin: 10px 0 4px; font-weight: 600; }
.msg.assistant .msg-bubble h3 { font-size: 13px; margin: 8px 0 4px; font-weight: 600; }
.msg.assistant .msg-bubble h4,
.msg.assistant .msg-bubble h5,
.msg.assistant .msg-bubble h6 { font-size: 12px; margin: 6px 0 3px; font-weight: 600; }
.msg.assistant .msg-bubble p { margin: 4px 0; }
.msg.assistant .msg-bubble p:first-child { margin-top: 0; }
.msg.assistant .msg-bubble p:last-child { margin-bottom: 0; }
.msg.assistant .msg-bubble ul,
.msg.assistant .msg-bubble ol { margin: 4px 0; padding-left: 20px; }
.msg.assistant .msg-bubble li { margin: 2px 0; }
.msg.assistant .msg-bubble a { color: var(--accent); text-decoration: none; }
.msg.assistant .msg-bubble a:hover { text-decoration: underline; }
.msg.assistant .msg-bubble blockquote {
  border-left: 2px solid var(--accent);
  margin: 6px 0; padding: 4px 12px;
  color: var(--text-secondary);
  background: rgba(139,156,240,0.04);
  border-radius: 0 4px 4px 0;
}
.msg.assistant .msg-bubble hr {
  border: none; border-top: 1px solid var(--glass-border);
  margin: 10px 0;
}
.msg.assistant .msg-bubble table {
  border-collapse: collapse; margin: 6px 0;
  font-size: 12px; width: 100%;
}
.msg.assistant .msg-bubble th,
.msg.assistant .msg-bubble td {
  border: 1px solid rgba(255,255,255,0.1);
  padding: 4px 10px; text-align: left;
}
.msg.assistant .msg-bubble th {
  background: rgba(255,255,255,0.04);
  font-weight: 600; color: var(--text-primary);
}
.msg.assistant .msg-bubble code {
  background: rgba(255,255,255,0.06);
  padding: 1px 5px; border-radius: 3px;
  font-size: 11px;
  font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
}
.msg.assistant .msg-bubble pre {
  background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px;
  overflow-x: auto; font-size: 11px; margin: 6px 0;
  font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
  line-height: 1.5;
}
.msg.assistant .msg-bubble pre code {
  background: none; padding: 0; font-size: inherit;
}
.msg.assistant .msg-bubble strong { font-weight: 600; color: var(--text-primary); }
.msg.assistant .msg-bubble em { font-style: italic; }
.msg.assistant .msg-bubble img { max-width: 100%; border-radius: 6px; margin: 4px 0; }
.msg.assistant .msg-bubble input[type="checkbox"] {
  margin-right: 4px; accent-color: var(--accent);
}

/* 输入区 */
.chat-input-area {
  padding: 10px 12px;
  border-top: 1px solid var(--glass-border);
  display: flex; align-items: flex-end; gap: 8px;
  flex-shrink: 0;
}
.chat-input {
  flex: 1; resize: none;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 9px 12px;
  color: var(--text-primary); font-size: 13px;
  font-family: inherit; line-height: 1.5;
  outline: none; max-height: 120px;
  transition: border-color 0.2s;
  user-select: text;
}
.chat-input:focus { border-color: rgba(139,156,240,0.3); }
.chat-input::placeholder { color: rgba(255,255,255,0.20); }
.send-btn {
  width: 34px; height: 34px; border-radius: 50%;
  border: none; background: rgba(139,156,240,0.15);
  color: var(--accent); font-size: 16px;
  cursor: pointer; flex-shrink: 0;
  transition: background 0.15s;
  display: flex; align-items: center; justify-content: center;
}
.send-btn:hover { background: rgba(139,156,240,0.25); }

/* 附件徽章 */
.chat-attachments {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 6px 12px 0; flex-shrink: 0;
}
.chat-attachment-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--accent);
  background: rgba(139,156,240,0.10);
  border: 1px solid rgba(139,156,240,0.15);
  border-radius: 6px; padding: 2px 6px 2px 8px;
}
.chat-attachment-remove {
  border: none; background: none;
  color: var(--text-muted); cursor: pointer;
  font-size: 14px; line-height: 1;
  padding: 0 2px;
}
.chat-attachment-remove:hover { color: #f87171; }

/* 拖放高亮 */
.chat-input-area.drop-target .chat-input {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(139,156,240,0.2);
}

/* 少女祈祷中 */
@keyframes praying-breathe {
  0%, 100% {
    background: rgba(248,113,113,0.7);
    box-shadow: 0 0 4px rgba(248,113,113,0.5);
    transform: scale(0.85);
  }
  50% {
    background: rgba(74,222,128,0.9);
    box-shadow: 0 0 8px rgba(74,222,128,0.6);
    transform: scale(1.15);
  }
}
.praying-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.praying-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: praying-breathe 2s ease-in-out infinite;
  flex-shrink: 0;
}
.praying-text {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  user-select: none;
}
.praying-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
  flex-shrink: 0;
}
.praying-bar .praying-text {
  font-size: 13px;
}
```

- [ ] **Step 2: 创建 session-panel.css**

从 App.css 提取，写入 `frontend/src/extensions/session-panel/session-panel.css`：

```css
/* ====== 会话面板 ====== */
.session-panel {
  display: flex; flex-direction: column;
  overflow: hidden;
}
.session-panel:not(.expanded) {
  flex-shrink: 0;
}

.session-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-radius: 14px;
  transition: background 0.15s;
  flex-shrink: 0;
}
.session-header:hover { background: rgba(255,255,255,0.04); }
.session-header .avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(139,156,240,0.18);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}
.session-header .meta { flex: 1; min-width: 0; }
.session-header .title {
  font-size: 15px; font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.session-header .time {
  font-size: 11px; color: var(--text-muted);
  margin-top: 1px;
}
.session-header .badge-group { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.session-header .badge {
  font-size: 11px; color: var(--text-secondary);
  background: rgba(255,255,255,0.06);
  padding: 3px 10px; border-radius: 10px;
}
.session-header .expand-arrow {
  font-size: 10px; color: var(--text-secondary);
  transition: transform 0.25s; flex-shrink: 0;
}
.session-panel.expanded .expand-arrow { transform: rotate(180deg); }

.sub-sessions {
  overflow: hidden;
  max-height: 0; opacity: 0;
  margin: 0 16px;
}
.session-panel.expanded .sub-sessions {
  max-height: 25vh;
  opacity: 1;
  margin: 8px 16px 10px;
  display: flex; flex-direction: column;
  overflow-y: auto;
}

.sub-search {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 7px 10px;
  color: var(--text-primary); font-size: 12px;
  outline: none; margin-bottom: 8px; flex-shrink: 0;
  transition: border-color 0.2s;
}
.sub-search:focus { border-color: rgba(139,156,240,0.3); }
.sub-search::placeholder { color: rgba(255,255,255,0.20); }

.sub-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.sub-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: 8px;
  cursor: pointer; transition: background 0.12s;
  font-size: 13px;
}
.sub-item:hover { background: rgba(255,255,255,0.05); }
.sub-item.active { background: rgba(139,156,240,0.10); }
.sub-item .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); flex-shrink: 0;
  opacity: 0; transition: opacity 0.2s;
}
.sub-item.active .dot { opacity: 1; }
.sub-item .sub-title {
  flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--text-secondary);
}
.sub-item.active .sub-title { color: var(--text-primary); }
.sub-item .sub-time {
  font-size: 11px; color: var(--text-muted); flex-shrink: 0;
}

.sub-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}

.del-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.15s;
}
.del-btn:hover { color: #f87171; }
```

- [ ] **Step 3: 创建 tool-panel.css**

从 App.css 提取，写入 `frontend/src/extensions/tool-panel/tool-panel.css`：

```css
/* ====== 工具面板 ====== */
.tool-panel { display: flex; flex-direction: column; min-height: 0; }

.tool-panel-header {
  padding: 10px 16px;
  font-size: 11px; font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--glass-border);
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
.tool-panel-header .indicator {
  width: 7px; height: 7px; border-radius: 50%;
  background: #4ade80; transition: background 0.3s;
}
.tool-panel-header .indicator.idle { background: rgba(255,255,255,0.15); }
.tool-count { font-size: 10px; color: var(--text-muted); margin-left: auto; }
.cancel-btn {
  background: rgba(248,113,113,0.12);
  border: 1px solid rgba(248,113,113,0.2);
  color: #f87171; cursor: pointer;
  font-size: 12px; padding: 2px 6px; border-radius: 4px;
  line-height: 1; flex-shrink: 0;
}
.cancel-btn:hover { background: rgba(248,113,113,0.22); }
.cancel-toast {
  font-size: 10px; color: #f87171;
  animation: cancel-fade 2s ease-out forwards;
  flex-shrink: 0;
}
@keyframes cancel-fade {
  0% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; }
}

.tool-list {
  flex: 1; overflow-y: auto; padding: 6px;
  min-height: 0;
}

.tool-entry {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 8px 12px; border-radius: 8px;
  font-size: 12px; margin: 2px 0;
  cursor: pointer;
  transition: background 0.12s;
}
.tool-entry:hover { background: rgba(255,255,255,0.04); }
.tool-entry.running { background: rgba(139,156,240,0.08); }
.tool-entry.expanded { background: rgba(255,255,255,0.03); }

.tool-entry .tool-icon {
  width: 22px; height: 22px; border-radius: 5px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; flex-shrink: 0;
  background: rgba(255,255,255,0.06);
}
.tool-entry.running .tool-icon {
  background: rgba(139,156,240,0.15);
  animation: tool-pulse 1.5s ease-in-out infinite;
}
@keyframes tool-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.tool-entry .tool-info { flex: 1; min-width: 0; }
.tool-entry .tool-name {
  font-weight: 500; font-size: 12px;
  color: var(--text-primary);
}
.tool-entry .tool-detail {
  font-size: 11px; color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 2px;
}
.tool-entry .tool-status {
  font-size: 10px; padding: 2px 8px; border-radius: 8px;
  flex-shrink: 0; align-self: center;
}
.tool-entry .tool-status.ok { color: #4ade80; background: rgba(74,222,128,0.08); }
.tool-entry .tool-status.running { color: var(--accent); background: rgba(139,156,240,0.12); }
.tool-entry .tool-status.error { color: #f87171; background: rgba(248,113,113,0.08); }

.tool-detail-body {
  display: none;
  padding: 0 12px 10px 44px;
  font-size: 11px; color: var(--text-secondary);
  font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
  white-space: pre-wrap; word-break: break-all;
  line-height: 1.5;
  max-height: 140px; overflow-y: auto;
}
.tool-entry.expanded .tool-detail-body { display: block; }
.tool-detail-body .detail-label {
  color: var(--text-muted); font-size: 10px;
  font-family: inherit;
}
```

- [ ] **Step 4: 创建 status-bar.css**

从 App.css 提取，写入 `frontend/src/extensions/status-bar/status-bar.css`：

```css
/* ====== 底部状态栏：时钟 + 用量 + 模型 ====== */
.status-bar {
  display: flex; flex-direction: column; gap: 8px;
  padding: 4px;
}
.status-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px;
  font-size: 13px; color: var(--text-secondary);
  border-bottom: 1px solid var(--glass-border);
}
.status-row:last-child { border-bottom: none; }

.status-label {
  color: var(--text-muted); font-size: 12px;
  white-space: nowrap; flex-shrink: 0;
}
.status-value {
  color: var(--text-primary); font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.status-value.mono {
  font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
  font-size: 13px;
}
.status-spacer { flex: 1; }

/* 上下文用量条 */
.ctx-bar-wrap {
  padding: 2px 16px 8px;
}
.ctx-bar-label {
  display: flex; justify-content: space-between;
  font-size: 11px; color: var(--text-muted);
  margin-bottom: 4px;
}
.ctx-bar {
  height: 4px; border-radius: 2px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}
.ctx-bar-fill {
  height: 100%; border-radius: 2px;
  background: var(--accent);
  transition: width 0.5s ease;
}
.ctx-bar-fill.warn { background: #f4a236; }
.ctx-bar-fill.danger { background: #f87171; }

/* 压缩反馈提示 */
.compact-feedback {
  font-size: 11px; text-align: center;
  padding: 3px 0;
  animation: compact-feedback-in 0.25s ease;
  user-select: text;
  cursor: pointer;
  display: inline-flex; align-items: center;
  gap: 4px;
}
.compact-feedback-text {
  user-select: text;
}
.compact-feedback-copy {
  user-select: none;
}
.compact-feedback:hover .compact-feedback-copy {
  opacity: 1 !important;
}
.compact-feedback--success { color: #4ade80; }
.compact-feedback--error   { color: #f87171; }
@keyframes compact-feedback-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.compact-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 14px;
  margin-left: 6px;
  padding: 0;
  line-height: 1;
}
.compact-btn:disabled { color: var(--text-muted); cursor: default; }
```

- [ ] **Step 5: 创建 file-tree.css**

从 App.css 提取，写入 `frontend/src/extensions/file-tree/file-tree.css`：

```css
/* ====== 文件树样式 ====== */
.file-tree { font-size: 12px; }
.file-tree-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 4px; border-radius: 4px;
  cursor: pointer; color: var(--text-secondary);
  transition: background 0.1s;
}
.file-tree-item:hover { background: rgba(255,255,255,0.04); }
.file-tree-item .ft-icon { font-size: 12px; width: 16px; text-align: center; flex-shrink: 0; }
.file-tree-item.dir { color: var(--text-primary); }
.file-tree-item .ft-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-tree-indent { padding-left: 16px; }

.file-tree-empty {
  font-size: 11px; color: var(--text-muted);
  padding: 6px 4px; font-style: italic;
}
.file-tree-loading {
  font-size: 11px; color: var(--text-muted);
  padding: 6px 4px;
  animation: pulse-text 1.5s ease-in-out infinite;
}
.file-tree-error {
  font-size: 11px; color: #f87171;
  padding: 6px 4px;
}
.file-tree-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 2px 4px; border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
  gap: 4px;
}
.file-tree-root-path {
  font-size: 10px; color: var(--text-muted); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;
  padding: 0 4px;
}
.file-tree-refresh-btn {
  background: none; border: none; color: var(--text-muted);
  font-size: 14px; cursor: pointer; padding: 2px 6px; border-radius: 4px;
  line-height: 1;
}
.file-tree-refresh-btn:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.08);
}
@keyframes pulse-text {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
```

- [ ] **Step 6: 创建 doc-preview.css**

从 App.css 提取，写入 `frontend/src/extensions/doc-preview/doc-preview.css`：

```css
/* ====== 预览区 ====== */
.preview-rendered {
  font-size: 13px; line-height: 1.7; color: var(--text-primary);
  height: 100%; overflow: auto;
}
.preview-rendered h1 { font-size: 18px; margin: 12px 0 6px; }
.preview-rendered h2 { font-size: 15px; margin: 10px 0 4px; }
.preview-rendered h3 { font-size: 13px; margin: 8px 0 4px; }
.preview-rendered p { margin: 4px 0; }
.preview-rendered code {
  background: rgba(255,255,255,0.06); padding: 1px 5px;
  border-radius: 3px; font-size: 11px;
  font-family: "Cascadia Code", "Fira Code", monospace;
}
.preview-rendered pre {
  background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px;
  overflow-x: auto; font-size: 11px;
  font-family: "Cascadia Code", "Fira Code", monospace;
  line-height: 1.5;
}
.preview-source {
  font-family: "Cascadia Code", "Fira Code", monospace;
  font-size: 11px; line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap; word-break: break-all;
  margin: 0; padding: 8px;
  background: rgba(0,0,0,0.2); border-radius: 6px;
  height: 100%; overflow: auto;
  background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px;
  max-height: 100%; overflow-y: auto;
}
```

- [ ] **Step 7: 创建 right-panel.css**

从 App.css 提取，写入 `frontend/src/extensions/right-panel/right-panel.css`：

```css
/* ====== 右侧展开面板 ====== */
.right-panel {
  display: flex; flex-direction: column;
  width: 100%; height: 100%;
  min-width: 200px;
  position: relative;
  overflow: hidden;
}

.right-panel-header {
  padding: 0;
  flex-shrink: 0;
  display: flex; align-items: center;
  border-bottom: 1px solid var(--glass-border);
}
.right-panel-tab {
  flex: 1; padding: 8px 0;
  font-size: 11px; font-weight: 500;
  color: var(--text-muted); text-align: center;
  cursor: pointer; user-select: none;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.right-panel-tab:hover { color: var(--text-secondary); }
.right-panel-tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}
.right-panel-close {
  width: 28px; height: 28px; border-radius: 4px;
  border: none; background: transparent;
  color: var(--text-secondary); cursor: pointer;
  font-size: 14px; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0; margin-right: 4px;
}
.right-panel-close:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
.right-panel-body {
  flex: 1; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; padding: 10px 14px;
  min-height: 0; word-break: break-all;
}
.right-panel-body .tab-content { display: none; }
.right-panel-body .tab-content.active { display: block; }

/* 视图切换按钮组 */
.view-toggle {
  display: flex; gap: 2px; margin-bottom: 10px;
  background: rgba(255,255,255,0.04); border-radius: 6px;
  padding: 2px;
}
.view-toggle-btn {
  flex: 1; padding: 4px 0; font-size: 11px;
  text-align: center; border-radius: 4px;
  cursor: pointer; user-select: none;
  color: var(--text-muted); border: none;
  background: transparent;
  transition: all 0.15s;
}
.view-toggle-btn.active {
  background: rgba(255,255,255,0.08);
  color: var(--text-primary);
}

.tab-content-persist {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 展开标签 */
.expand-tab {
  position: fixed;
  right: 0; top: 45%;
  z-index: 35;
  display: flex; align-items: center; gap: 4px;
  padding: 10px 8px 10px 12px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-right: none;
  border-radius: 8px 0 0 8px;
  color: var(--text-secondary); font-size: 11px;
  cursor: pointer; user-select: none;
  writing-mode: vertical-lr;
  letter-spacing: 2px;
  transition: all 0.2s;
}
.expand-tab:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.08);
  padding-right: 12px;
}
.expand-tab.hidden { opacity: 0; pointer-events: none; }
```

- [ ] **Step 8: 创建 top-menu.css**

从 App.css 提取，写入 `frontend/src/extensions/top-menu/top-menu.css`：

```css
/* ====== 顶部菜单项 ====== */
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
```

- [ ] **Step 9: 创建 settings-page.css**

从 App.css 提取，写入 `frontend/src/extensions/settings-page/settings-page.css`：

```css
/* ====== 设置页内容样式 ====== */
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
  border-left-color: #8b9cf0;
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
  color: #8b9cf0;
}

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
  color: #8b9cf0; font-size: 14px; cursor: pointer;
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

.settings-model-search {
  width: 100%; padding: 8px 12px; margin-bottom: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: var(--text-primary); font-size: 12px;
  outline: none; font-family: inherit;
  transition: border-color 0.2s;
}
.settings-model-search:focus { border-color: rgba(139,156,240,0.35); }
.settings-model-search::placeholder { color: rgba(255,255,255,0.20); }

.model-table-wrap {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 8px;
}

/* ====== 技能管理 ====== */
.skill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
}

.skill-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  transition: border-color 0.2s;
}
.skill-card:hover { border-color: rgba(255,255,255,0.12); }

.skill-card-body { flex: 1; min-width: 0; margin-right: 12px; }

.skill-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-source-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 400;
}
.skill-source-badge.user {
  background: rgba(139,156,240,0.15);
  color: var(--accent);
}
.skill-source-badge.project {
  background: rgba(74,222,128,0.12);
  color: #4ade80;
}

.skill-card-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
}

.skill-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.skill-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
}
.toggle-track {
  display: block;
  width: 36px;
  height: 20px;
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
}
.skill-toggle.on .toggle-track { background: var(--accent); }
.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.skill-toggle.on .toggle-thumb { transform: translateX(16px); }

.skill-remove-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.15s;
}
.skill-remove-btn:hover {
  color: #ef4444;
  background: rgba(239,68,68,0.08);
  border-color: rgba(239,68,68,0.2);
}

.settings-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--glass-border);
  background: rgba(255,255,255,0.04);
  color: var(--text-primary);
  transition: all 0.2s;
}
.settings-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.settings-btn.primary:hover { filter: brightness(1.1); }
.settings-btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: none;
}
```

- [ ] **Step 10: 瘦身 App.css — 删除已移动的 CSS**

修改 `frontend/src/shell/App.css`，删除以下已移至扩展/组件 CSS 的选择器块：

- `会话面板 (.session-*)` L67-166
- `工具面板 (.tool-*)` L170-266
- `对话面板 (.chat-*)` L268-457
- `消息 (.msg*)` L300-365
- `Markdown (.msg.assistant .msg-bubble *)` L367-426
- `输入区 (.chat-input*)` L428-457
- `状态栏 (.status-*)` L459-533
- `右侧面板 (.right-panel*)` L535-575
- `视图切换 (.view-toggle*)` L578-595
- `文件树 (.file-tree*)` L597-769
- `预览区 (.preview-*)` L612-641
- `展开标签 (.expand-tab)` L643-667
- `拖拽把手 (.panel-drag-handle)` L670-681
- `顶部菜单项 (.top-menu-item)` L882-892
- `设置页面内容 (.settings-*)` L894-1251
- `紧凑按钮 (.compact-btn)` L692-700
- `删除按钮 (.del-btn)` L704-714
- `子会话工具栏 (.sub-toolbar)` L718-722
- `Tab 持久容器 (.tab-content-persist)` L726-730
- `按钮 (取消、中断等)` 已包含在各扩展 CSS 中

保留：
- `:root` CSS 变量（L2-13）
- `*` reset（L16）
- `html, body, #root`（L18-25）
- `::-webkit-scrollbar`（L28-33）
- `.overlay` Grid 布局系列（L36-55）
- `.top-menu-toggle` + `.top-menu-bar`（L840-880, shell 级）
- `.settings-page` 外层容器（L894-903, shell 级）
- `.praying-bar`（L829-839, 被多处引用）
- `.praying-indicator` / `.praying-dot` / `.praying-text` / `@keyframes praying-breathe`（L798-838, 被 SessionPanel 和 ChatRenderer 共用）
- 小屏 @media（L684-689）
- `@keyframes pulse-text`（L766-769, 被 file-tree 引用）

- [ ] **Step 11: 为每个扩展 TSX 添加 CSS import**

对以下文件的 `index.ts` 或主组件文件，在 imports 区域末尾添加 CSS import：

- `frontend/src/extensions/chat-renderer/ChatRenderer.tsx` — 添加 `import './chat-renderer.css'`
- `frontend/src/extensions/session-panel/SessionPanel.tsx` — 添加 `import './session-panel.css'`
- `frontend/src/extensions/tool-panel/ToolPanel.tsx` — 添加 `import './tool-panel.css'`
- `frontend/src/extensions/status-bar/StatusBar.tsx` — 添加 `import './status-bar.css'`
- `frontend/src/extensions/file-tree/FileTree.tsx` — 添加 `import './file-tree.css'`
- `frontend/src/extensions/doc-preview/DocPreview.tsx` — 添加 `import './doc-preview.css'`
- `frontend/src/extensions/right-panel/RightPanelTabs.tsx` — 添加 `import './right-panel.css'`
- `frontend/src/extensions/top-menu/TopMenuBar.tsx` — 添加 `import './top-menu.css'`
- `frontend/src/extensions/settings-page/SettingsPage.tsx` — 添加 `import './settings-page.css'`

- [ ] **Step 12: 验证 TypeScript 编译**

```bash
cd frontend && npx tsc --noEmit
```

预期：无新增错误（所有 CSS import 由 Vite 处理，不在 tsc 范围）

- [ ] **Step 13: 验证 Vite 构建**

```bash
cd frontend && npx vite build
```

预期：构建成功，无 CSS 缺失警告

- [ ] **Step 14: 提交**

```bash
git add frontend/
git commit -m "refactor: 拆分 App.css 到 9 扩展 + 保留 shell 级样式"
```

---

### Task 11: App.tsx 使用 DragHandle 组件

**Files:**
- Modify: `frontend/src/shell/App.tsx`

- [ ] **Step 1: 替换 App.tsx 中的拖拽把手**

修改 `frontend/src/shell/App.tsx`：

1. 在文件顶部添加 import：
```tsx
import { DragHandle } from '@/components/drag-handle'
```

2. 删除 `handleDragStart` 函数（L49-81）

3. 将 `<div class="panel-drag-handle" onMouseDown={handleDragStart} onDblClick={...} />` 替换为：
```tsx
<DragHandle
  onDrag={(deltaX) => {
    const w = rightPanelW() - deltaX
    const clamped = Math.max(0, Math.min(900, w))
    setRightPanelW(clamped)
    if (clamped < 120 && w < 120) {
      setPanelVisible(false)
    } else if (clamped > 0) {
      setPanelVisible(true)
    }
  }}
  onDoubleClick={() => {
    setRightPanelW(0)
    setPanelVisible(false)
  }}
/>
```

App.tsx 中 DragHandle 使用：
```tsx
<DragHandle
  onDrag={(deltaX) => {
    const w = rightPanelW() - deltaX
    const clamped = Math.max(0, Math.min(900, w))
    setRightPanelW(clamped)
    if (clamped < 120 && w < 120) {
      setPanelVisible(false)
    } else if (clamped > 0) {
      setPanelVisible(true)
    }
  }}
  onDragEnd={() => savePanelState(rightPanelW(), panelVisible())}
  onDoubleClick={() => {
    setRightPanelW(0)
    setPanelVisible(false)
    savePanelState(0, false)
  }}
/>
```

- [ ] **Step 2: 删除 App.css 中 DragHandle 相关样式**

确认 `.panel-drag-handle` 样式已在 Task 10 Step 10 中删除（已移入 `components/drag-handle/index.css`）。

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/shell/App.tsx frontend/src/components/drag-handle/index.tsx
git commit -m "refactor: App.tsx 使用 DragHandle 组件替换内联拖拽逻辑"
```

---

### Task 12: 扩展组件逐步替换为通用组件（可选，后续阶段）

> 本阶段只建组件库，不在扩展中强制使用。以下为后续替换指引。

| 扩展 | 当前实现 | 替换为 |
|------|---------|--------|
| StatusBar | `.ctx-bar` 裸 div | `<ProgressBar>` |
| SettingsPage | `.model-toggle` 裸 button | `<Toggle>` |
| SettingsPage | `.settings-model-search` 裸 input | `<GlassInput>` |
| SessionPanel | `.sub-search` 裸 input | `<GlassInput>` |
| SessionPanel | sending button（inline style） | `<IconButton>` |
| ChatRenderer | `.send-btn` | `<IconButton variant="accent">` |
| ToolPanel | `.indicator` | `<Spinner>` |
| RightPanel | `.right-panel-header` + `.right-panel-tab` | `<TabBar>` |

此任务不在本期实施范围内，可作为后续 PR。

---

### Task 13: 最终验证

- [ ] **Step 1: 运行 TypeScript 检查**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 2: 运行 Vite 构建**

```bash
cd frontend && npx vite build
```

- [ ] **Step 3: 启动 dev server 验证无视觉变化**

```bash
cd frontend && npx vite
```

手动检查：打开浏览器，确认所有面板、按钮、输入框、开关、滚动条视觉与改动前一致。

- [ ] **Step 4: 更新 CHANGELOG**

在 `CHANGELOG.md` 添加条目。

- [ ] **Step 5: 提交最终清理**

```bash
git add .
git commit -m "refactor: 前端组件库提取完成 — 9 通用组件 + 9 扩展 CSS 拆分"
```

---

## 实施顺序

```
Task 1  GlassPanel ──┐
Task 2  Spinner     ├─ 并行（无依赖）
Task 3  ProgressBar │
Task 4  Badge       │
Task 5  Toggle      │
Task 6  IconButton  │
Task 7  GlassInput  │
Task 8  TabBar      │
Task 9  DragHandle  │
         │           │
         └── 全部完成 ──→ Task 10  CSS 拆分
                              │
                              └──→ Task 11  App.tsx 替换 DragHandle
                                       │
                                       └──→ Task 12  最终验证
```

Task 1-9 可并行执行（组件之间零依赖），Task 10 必须在所有组件完成后执行，Task 11 依赖 Task 9 和 Task 10。

---

## 变更统计

| 类别 | 数量 | 说明 |
|------|------|------|
| 新建文件 | 18 | 9 组件 TSX + 9 组件 CSS + 0（扩展 CSS 在 Task 10） |
| 新建文件 | 9 | 扩展 CSS 文件 |
| 修改文件 | 2 | App.css + App.tsx |
| 修改文件 | 9 | 扩展 TSX（加 CSS import） |
| 删除行 | ~1100 | App.css 中移出的样式 |
| 新增行 | ~500 | 组件代码 + 扩展 CSS 文件 |
