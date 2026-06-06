# 前端组件库提取 — 设计 Spec

> 日期: 2026-06-06 | 版本: v1.0 | 状态: 待实施

---

## 一、设计目标

将前端代码中的可复用 UI 模式提取为通用组件库，建立组件化基础层。**不改变任何视觉效果**，只做代码层面的分离和封装。

| 目标 | 说明 |
|------|------|
| 提取通用组件 | 从 App.css 和现有 TSX 中识别重复 UI 模式，封装为独立组件 |
| CSS 模块化 | 1251 行单文件 App.css 拆分为 18 个组件/扩展级 CSS 文件 |
| 建立组件库 | `frontend/src/components/` 平铺目录，每个组件自包含（galaxy 风格） |
| 零视觉变更 | 所有颜色、间距、圆角、模糊值保持原样，仅移动代码位置 |
| 后期可替换 | 组件接口稳定后，后续 UI 改版直接换组件实现即可 |

---

## 二、参考项目

### uiverse-io/galaxy

- **仓库**: https://github.com/uiverse-io/galaxy
- **模式**: 按组件类型平铺文件夹（`buttons/`, `inputs/`, `cards/`, `toggles/`）
- **每个组件**: 一个 `.css` + 一个 `.html`（Tailwind 变体），自包含零依赖
- **许可**: MIT

### U1805/momotalk

- **仓库**: https://github.com/U1805/momotalk
- **模式**: 碧蓝档案风格对话编辑器，消息气泡组件化，主题可切换

---

## 三、技术选型

| 层 | 选型 | 说明 |
|----|------|------|
| 通用组件布局 | Tailwind class（传给 `style` prop） | 间距、弹性布局、尺寸由调用方控制 |
| 通用组件皮肤 | 组件级 CSS 文件 | 玻璃拟态特效（`backdrop-filter` 等 Tailwind 表达不了的） |
| 主题变量 | CSS 变量（`:root` 的 `--glass-bg` 等） | 组件 CSS 只读变量，不定义新变量 |
| 组件目录 | 平铺式（galaxy 风格） | 每个文件夹一个组件，两个文件：`index.tsx` + `index.css` |
| 命名规范 | kebab-case 目录名 | `glass-panel/`, `icon-button/`, `tab-bar/` |

---

## 四、目录结构

```
frontend/src/
├── components/                    ← 新增：通用组件库
│   ├── glass-panel/
│   │   ├── index.tsx              ← GlassPanel 组件
│   │   └── index.css              ← 玻璃拟态面板样式（~8行）
│   ├── glass-input/
│   │   ├── index.tsx
│   │   └── index.css
│   ├── icon-button/
│   │   ├── index.tsx
│   │   └── index.css
│   ├── badge/
│   │   ├── index.tsx
│   │   └── index.css
│   ├── toggle/
│   │   ├── index.tsx
│   │   └── index.css
│   ├── tab-bar/
│   │   ├── index.tsx
│   │   └── index.css
│   ├── drag-handle/
│   │   ├── index.tsx
│   │   └── index.css
│   ├── progress-bar/
│   │   ├── index.tsx
│   │   └── index.css
│   └── spinner/
│       ├── index.tsx
│       └── index.css
├── shell/
│   ├── App.tsx                    ← 不改结构，DragHandle 逻辑移到组件内
│   ├── App.css                    ← 大幅瘦身（1251 → ~150 行）
│   ├── useAgent.tsx               ← 不变
│   └── settings-signal.ts         ← 不变
├── registry.ts                    ← 不变
├── index.tsx                      ← 不变
└── extensions/
    ├── chat-renderer/
    │   ├── index.ts
    │   ├── ChatRenderer.tsx       ← 添加 `import './chat-renderer.css'`
    │   └── chat-renderer.css      ← 新增（从 App.css 移出）
    ├── session-panel/
    │   ├── index.ts
    │   ├── SessionPanel.tsx
    │   └── session-panel.css      ← 新增
    ├── tool-panel/
    │   ├── index.ts
    │   ├── ToolPanel.tsx
    │   └── tool-panel.css         ← 新增
    ├── file-tree/
    │   ├── index.ts
    │   ├── FileTree.tsx
    │   └── file-tree.css          ← 新增
    ├── doc-preview/
    │   ├── index.ts
    │   ├── DocPreview.tsx
    │   └── doc-preview.css        ← 新增
    ├── top-menu/
    │   ├── index.ts
    │   ├── TopMenuBar.tsx
    │   └── top-menu.css           ← 新增
    ├── settings-page/
    │   ├── index.ts
    │   ├── SettingsPage.tsx
    │   └── settings-page.css      ← 新增
    ├── right-panel/
    │   ├── index.ts
    │   ├── RightPanelTabs.tsx
    │   └── right-panel.css        ← 新增
    └── status-bar/
        ├── index.ts
        ├── StatusBar.tsx
        └── status-bar.css         ← 新增
```

---

## 五、组件 API 设计

### 5.1 GlassPanel — 玻璃拟态容器

**来源：** `App.css` L58-64 的 `.glass-panel`（6 行）

```typescript
interface GlassPanelProps {
  children: JSX.Element
  style?: string        // Tailwind class，控制布局行为
  class?: string        // 附加自定义 CSS class
}
```

CSS（`glass-panel/index.css`）：
```css
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
}
```

### 5.2 GlassInput — 玻璃拟态输入框

**来源：** `.chat-input` + `.sub-search` + `.settings-model-search`（3 处合并）

```typescript
interface GlassInputProps {
  value: string
  onInput: (value: string) => void
  placeholder?: string
  type?: 'text' | 'search'
  style?: string
}
```

### 5.3 IconButton — 图标按钮底座

**来源：** `.send-btn` + `.settings-back-btn` + `.compact-btn` + `.del-btn` + `.file-tree-refresh-btn`

```typescript
interface IconButtonProps {
  icon: string           // emoji 或单字符
  onClick: () => void
  size?: 'sm' | 'md'    // sm=28px, md=34px
  variant?: 'ghost' | 'accent'
  title?: string
  disabled?: boolean
}
```

### 5.4 Badge — 标签/徽章

**来源：** `.badge` + `.chat-attachment-badge` + `.skill-source-badge`

```typescript
interface BadgeProps {
  children: JSX.Element
  variant?: 'default' | 'accent' | 'success'
  removable?: boolean
  onRemove?: () => void
}
```

### 5.5 Toggle — 开关

**来源：** `.model-toggle` + `.skill-toggle`（两个完全相同的实现）

```typescript
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}
```

### 5.6 TabBar — 标签栏

**来源：** `.right-panel-header` + `.right-panel-tab`

```typescript
interface TabBarProps {
  tabs: { id: string; label: string }[]
  activeTab: string
  onTabChange: (id: string) => void
}
```

### 5.7 DragHandle — 拖拽把手

**来源：** App.tsx `handleDragStart` + `.panel-drag-handle`（逻辑从 App.tsx 提取）

```typescript
interface DragHandleProps {
  onDrag: (deltaX: number) => void
  onDoubleClick?: () => void
  axis?: 'x' | 'y'
}
```

### 5.8 ProgressBar — 进度条

**来源：** `.ctx-bar` + `.ctx-bar-fill` + `.ctx-bar-label`

```typescript
interface ProgressBarProps {
  value: number
  max: number
  showLabel?: boolean
  warnThreshold?: number    // > 此值变黄，默认 60
  dangerThreshold?: number  // > 此值变红，默认 80
}
```

### 5.9 Spinner — 脉冲指示器

**来源：** `.indicator` + `.praying-dot`（同一个 `@keyframes pulse`）

```typescript
interface SpinnerProps {
  active: boolean
  size?: 'sm' | 'md'
}
```

---

## 六、CSS 拆分映射

### 6.1 App.css 保留内容（~150 行）

| 内容 | 原因 |
|------|------|
| `:root` CSS 变量 | 全局主题，所有组件引用 |
| `*` reset | 全局重置 |
| `html, body, #root` | 全局容器 |
| `::-webkit-scrollbar` | 统一滚动条 |
| `.overlay` 系列（Grid 布局） | shell 专属 |
| `.top-menu-toggle` / `.top-menu-bar` | shell 级顶部菜单 |
| `.settings-page` 外层（全屏覆盖容器） | shell 级 |

### 6.2 移至组件的 CSS

| App.css 原选择器 | 目标文件 |
|---|---|
| `.glass-panel` (L58-64) | `components/glass-panel/index.css` |
| `.chat-input` (L435-448) | `components/glass-input/index.css` |
| `.sub-search` (L128-137) | 合并进 glass-input |
| `.settings-model-search` | 合并进 glass-input |
| `.send-btn` (L449-457) | `components/icon-button/index.css` |
| `.compact-btn` / `.del-btn` / `.settings-back-btn` / `.file-tree-refresh-btn` | 合并进 icon-button |
| `.badge` / `.chat-attachment-badge` / `.skill-source-badge` | `components/badge/index.css` |
| `.model-toggle` / `.skill-toggle` | `components/toggle/index.css` |
| `.right-panel-header` / `.right-panel-tab` | `components/tab-bar/index.css` |
| `.panel-drag-handle` (L670-681) | `components/drag-handle/index.css` |
| `.ctx-bar` / `.ctx-bar-fill` / `.ctx-bar-label` (L487-506) | `components/progress-bar/index.css` |
| `.indicator` / `.praying-dot` / `@keyframes pulse` | `components/spinner/index.css` |

### 6.3 移至扩展的 CSS

| App.css 原选择器 | 目标文件 |
|---|---|
| `.session-panel` 全系列 (L67-166) | `extensions/session-panel/session-panel.css` |
| `.tool-panel` 全系列 (L170-266) | `extensions/tool-panel/tool-panel.css` |
| `.chat-panel` / `.chat-header` / `.chat-messages` / `.msg` / `.msg-bubble` / Markdown / `.thinking-*` (L268-528) | `extensions/chat-renderer/chat-renderer.css` |
| `.file-tree-*` (L597-769) | `extensions/file-tree/file-tree.css` |
| `.preview-*` (L612-641) | `extensions/doc-preview/doc-preview.css` |
| `.right-panel` / `.right-panel-body` / `.tab-content` / `.view-toggle` (L535-595) | `extensions/right-panel/right-panel.css` |
| `.status-*` / `.compact-feedback` (L459-533) | `extensions/status-bar/status-bar.css` |
| `.settings-*` (L894-1251) | `extensions/settings-page/settings-page.css` |
| `.top-menu-*` (L840-892) | `extensions/top-menu/top-menu.css` |
| `.expand-tab` (L643-667) | 合并进 right-panel.css |

---

## 七、原则与约束

### 硬约束
1. **不改视觉效果** — 所有颜色、间距、圆角、模糊值保持原样
2. **组件 CSS 自包含** — 每个组件的 CSS 只包含自己的选择器，不依赖 App.css 中的其他选择器
3. **变量是唯一共享层** — 组件 CSS 只读 `var(--xxx)`，不定义新变量（组件内部动画允许 `@keyframes`）
4. **扩展 CSS 边界清晰** — 每个扩展的 CSS 只包含该扩展的选择器，不跨扩展引用
5. **删组件 = 删文件夹** — 删掉一个组件文件夹，对应功能完全消失，不影响其他组件

### 软约束
6. **Props 不传视觉属性** — 颜色、圆角等由 CSS 变量统一控制，不通过 props 覆盖
7. **布局由调用方控制** — 组件通过 `style` prop 接收 Tailwind class 控制弹性/尺寸/间距
8. **先建后用** — 先完成 9 个通用组件，再逐步更新扩展引用

---

## 八、变更清单

| # | 操作 | 文件 | 说明 |
|---|------|------|------|
| 1 | 新建 | `components/glass-panel/index.tsx` + `.css` | ~25 行 |
| 2 | 新建 | `components/glass-input/index.tsx` + `.css` | ~35 行 |
| 3 | 新建 | `components/icon-button/index.tsx` + `.css` | ~50 行 |
| 4 | 新建 | `components/badge/index.tsx` + `.css` | ~35 行 |
| 5 | 新建 | `components/toggle/index.tsx` + `.css` | ~40 行 |
| 6 | 新建 | `components/tab-bar/index.tsx` + `.css` | ~30 行 |
| 7 | 新建 | `components/drag-handle/index.tsx` + `.css` | ~50 行 |
| 8 | 新建 | `components/progress-bar/index.tsx` + `.css` | ~30 行 |
| 9 | 新建 | `components/spinner/index.tsx` + `.css` | ~25 行 |
| 10 | 新建 9 个扩展 CSS | `extensions/*/xxx.css` | 从 App.css 移动 |
| 11 | 修改 | `shell/App.css` | 删除已移出的 ~1100 行 |
| 12 | 修改 | `shell/App.tsx` | DragHandle 替换为组件 |
| 13 | 修改 9 个扩展 TSX | 各 `index.ts` 或主组件 | 添加 `import './xxx.css'` |

**总计：18 新文件，~320 新增行，~1100 删除行。**

---

## 九、不涉及

| 项 | 说明 |
|----|------|
| 视觉变更 | 所有颜色/间距/圆角/模糊保持原样 |
| 扩展机制改动 | `registry.ts` 和 slot 系统不动 |
| useAgent 重构 | 全局状态管理不在本期范围 |
| 消息协议变更 | `protocol.ts` 不动 |
| 桥接服务器 | `bridge/` 不改 |
| 打包/构建配置 | Vite/Tailwind 配置不动 |
| 测试 | 本期不加测试（纯代码移动，无逻辑变更） |

---

*此 spec 为实施前设计文档。实施完成后更新状态为"已完成"。*
