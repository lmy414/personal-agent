# 设置系统 设计 Spec

> 日期: 2026-05-31 | 状态: 待实现

## 目标

在澪号中构建设置系统，包含：模型厂商接入、模型管理、默认参数配置。首次仅接入 DeepSeek，架构预留多厂商扩展能力。

---

## 架构总览

```
┌─ Frontend ─────────────────────────────────────────┐
│                                                     │
│  TopMenuBar（圆角梯形菜单栏）                         │
│  ├─ SettingsEntry → 打开设置页面                     │
│  └─ MainSessionEntry → 回到主会话                    │
│                                                     │
│  SettingsPage（全页面覆盖层）                         │
│  ├─ SettingsNav（左侧导航 200px）                    │
│  │   └─ 智能体基础设置（active）                     │
│  │   └─ 界面设置（disabled，占位）                   │
│  │   └─ ...（可扩展）                                │
│  └─ SettingsContent（右侧内容区）                    │
│      ├─ ProviderSection（厂商卡片 + 新增配置入口）    │
│      ├─ ModelTable（模型列表 + 展开独立参数）         │
│      └─ DefaultParams（思考强度/压缩阈值/默认模型）   │
│                                                     │
├─ Bridge ───────────────────────────────────────────┤
│                                                     │
│  protocol.ts                                        │
│  ├─ ClientMsg<'settings.get', {}>                   │
│  ├─ ClientMsg<'settings.set', { key, value }>       │
│  └─ ServerMsg<'settings.state', { entries }>        │
│                                                     │
│  handlers/settings.ts（新增）                        │
│  ├─ handleSettingsGet → SQLite settings 表          │
│  └─ handleSettingsSet → 写入 + 广播                 │
│                                                     │
│  pi-session.ts                                      │
│  └─ getAvailableModels() ← 已有，从 registry 读     │
│                                                     │
├─ SQLite ───────────────────────────────────────────┤
│                                                     │
│  settings 表（已有）                                  │
│  ├─ providers JSON（已配置厂商 + API keys）          │
│  ├─ default_model                                  │
│  ├─ thinking_level                                 │
│  ├─ compact_threshold                              │
│  └─ history_retention                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Bridge 协议 + 数据层

### 1.1 协议新增（protocol.ts）

```ts
// 客户端 → 服务端
ClientMsg<'settings.get', {}>
ClientMsg<'settings.set', { key: string; value: string }>

// 服务端 → 客户端
ServerMsg<'settings.state', { entries: { key: string; value: string }[] }>
```

### 1.2 新 handler（bridge/handlers/settings.ts）

```ts
export function handleSettingsGet(msg: ClientMessage, ws: WebSocket): void {
  const db = getDB()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  ws.send({ type: 'settings.state', payload: { entries: rows } })
}

export function handleSettingsSet(msg: ClientMessage, ws: WebSocket): void {
  const { key, value } = msg.payload as { key: string; value: string }
  const db = getDB()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  // 设置后返回全量
  handleSettingsGet(msg, ws)
}
```

### 1.3 设置项定义

| key | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `providers` | JSON | `[{"id":"deepseek","name":"DeepSeek","apiKey":"","models":[...]}]` | 已配置厂商列表 |
| `default_model` | string | `"deepseek-chat"` | 默认模型 ID |
| `thinking_level` | string | `"medium"` | low/medium/high |
| `compact_threshold` | number | `80` | 上下文压缩阈值 % |
| `history_retention` | number | `100` | 历史消息保留条数 |

### 1.4 调度注册（dispatcher.ts）

```ts
'settings.get': handleSettingsGet,
'settings.set': handleSettingsSet,
```

### 验证方式

```bash
# 写入设置
echo '{"type":"settings.set","id":"t1","sessionId":"","ts":0,"payload":{"key":"default_model","value":"deepseek-chat"}}' | websocat ws://localhost:9229

# 读取设置
echo '{"type":"settings.get","id":"t2","sessionId":"","ts":0,"payload":{}}' | websocat ws://localhost:9229
```

---

## Phase 2: 前端骨架

### 2.1 TopMenuBar 组件

**注册**: `extensions/top-menu/index.ts` → slot: `center`, 实际用 `position: fixed` 脱离 Grid

**结构**:
```tsx
// TopMenuBar.tsx
export function TopMenuBar() {
  const [open, setOpen] = createSignal(false)
  return (
    <>
      <div class="top-menu-toggle" classList={{ open: open() }} onClick={() => setOpen(!open())}>
        ▼
      </div>
      <div class="top-menu-bar" classList={{ open: open() }}>
        <button class="top-menu-item" onClick={() => { emit('open-settings') }}>
          ⚙ 设置
        </button>
        <button class="top-menu-item" onClick={() => { emit('go-main-session') }}>
          🎐 主会话
        </button>
      </div>
    </>
  )
}
```

**通信方式**: 通过 `useAgent()` Context 暴露 `isSettingsOpen` signal。TopMenuBar 调用 `setIsSettingsOpen(true)`，SettingsPage 监听该 signal 控制可见性。两个扩展不直接 import 对方。

### 2.2 SettingsPage 组件

**注册**: `extensions/settings-page/index.ts` → 不注册到 Grid slot，独立渲染为全页面覆盖层

**结构**:
```
SettingsPage
├─ Header（← 返回 + ⚙ 设置 + 副标题）
├─ Body
│   ├─ Nav（左侧 200px）
│   │   ├─ 智能体基础设置（active）
│   │   ├─ 界面设置（disabled）
│   │   ├─ 数据管理（disabled）
│   │   └─ 快捷键（disabled）
│   └─ Content（右侧 flex:1）
│       ├─ ProviderSection
│       │   ├─ ProviderCard（已配置厂商，初始仅 DeepSeek）
│       │   └─ "+ 新增配置" 按钮（Phase 2 仅占位，Phase 3 启用）
│       ├─ ModelSection
│       │   └─ ModelTable（可展开行，每行独立参数）
│       │       ├─ ★ 默认 / 模型名 / 厂商 / 上下文 / 状态
│       │       └─ 展开：思考强度 / Temperature / 上下文限制 / 启用
│       └─ DefaultParamsSection
│           ├─ 思考强度 select
│           ├─ 压缩阈值 input[number]
│           ├─ 历史保留 input[number]
│           └─ 当前默认模型（只读）
```

**数据流**:
```
SettingsPage mount
  → send('settings.get', {})
  → bridge returns settings.state
  → populate all fields

User modifies field
  → send('settings.set', { key, value })
  → bridge persists + returns settings.state
  → UI updates reactively
```

**可见性控制**: 全局 signal `isSettingsOpen`，TopMenuBar 点击设置 → set true，返回按钮/ESC → set false

### 2.3 样式迁移

从 `frontend-sketch/layout-mockup-v2.html` 提取以下 CSS 到 `App.css`:
- `.top-menu-toggle` / `.top-menu-bar` / `.top-menu-item`
- `.settings-page` / `.settings-nav` / `.settings-content`
- `.provider-card` / `.provider-add-btn`
- `.model-table` / `.model-config-row` / `.model-toggle`
- `.settings-form-row` / `.settings-select` / `.settings-input`

### 2.4 全局信号

在 `useAgent.tsx` 中新增:
```ts
// 设置页面可见性（跨扩展通信）
const [isSettingsOpen, setIsSettingsOpen] = createSignal(false)
```

并通过 Context 暴露 `isSettingsOpen` 和 `setIsSettingsOpen`。

### 验证方式

1. 启动前后端
2. 点击顶部 `▼` → 菜单栏展开
3. 点击「⚙ 设置」→ 设置全页面打开
4. 修改压缩阈值为 70 → 刷新页面 → 值持久化为 70 ✅
5. 点击模型行 → 展开独立参数 → 切换思考强度 ✅

---

## Phase 3: Pi 集成 + 厂商扩展

### 3.1 DeepSeek 接入

当前项目已通过环境变量 `DEEPSEEK_API_KEY` 接入 DeepSeek。Phase 3 在此基础上：

1. **自动发现 DeepSeek 模型**: 调 `modelRegistry.getAll()` 过滤 `provider === 'deepseek'`
2. **模型参数持久化**: 每模型的 thinking/temperature/enabled 存到 settings 表
3. **厂商 API Key 管理**: 已通过 `.env` 配置 → settings 页只读展示（后续 Phase 4 支持页面内编辑）

### 3.2 可扩展架构

新增厂商仅需：

1. **环境变量**: 设置 `{PROVIDER}_API_KEY`
2. **模型发现**: `modelRegistry.getAll()` 自动包含新厂商模型
3. **厂商卡片**: `ProviderSection` 遍历 settings.providers 数组，新厂商 push 即可
4. **模型参数**: 所有模型共享同一套参数 schema，自动生效

### 3.3 modelRegistry 集成

```ts
// bridge/handlers/settings.ts 新增
function getModelsForProvider(registry: ModelRegistry, provider: string) {
  return registry.getAll()
    .filter(m => (m as any).provider === provider || m.id?.startsWith(provider))
    .map(m => ({
      id: m.id ?? m.name,
      name: m.name,
      provider,
      contextWindow: m.contextWindow ?? 0,
    }))
}
```

### 验证方式

1. 确保 `DEEPSEEK_API_KEY` 已设置
2. 打开设置页面 → 已接入模型列表自动显示 `deepseek-chat`, `deepseek-v4-pro` 等
3. 模型上下文窗口显示正确（128k）
4. 禁用某模型 → 主界面模型下拉不再显示该模型

---

## 未来扩展（Phase 4+）

| 阶段 | 内容 |
|------|------|
| Phase 4 | Anthropic 接入 + API Key 页面内编辑 + 多厂商切换管理 |
| Phase 5 | 界面设置（主题/字体/面板宽度）|
| Phase 6 | 数据管理（导出/清除历史）|
| Phase 7 | 快捷键配置 |

---

## 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `bridge/handlers/settings.ts` | settings.get / settings.set handler |
| `frontend/src/extensions/top-menu/index.ts` | 菜单栏注册 |
| `frontend/src/extensions/top-menu/TopMenuBar.tsx` | 圆角梯形菜单栏组件 |
| `frontend/src/extensions/settings-page/index.ts` | 设置页注册 |
| `frontend/src/extensions/settings-page/SettingsPage.tsx` | 设置全页面组件 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `bridge/protocol.ts` | 新增 settings.get/set/state 消息类型 |
| `bridge/dispatcher.ts` | 注册 settings handler |
| `frontend/src/shell/useAgent.tsx` | 新增 isSettingsOpen signal + settings API |
| `frontend/src/shell/App.tsx` | 渲染 SettingsPage（条件渲染）|
| `frontend/src/shell/App.css` | 从原型迁移菜单栏+设置页 CSS |
| `frontend/index.html` 或入口 | import top-menu + settings-page 扩展 |
