> **⚠️ 已废弃** — Live2D 集成已从主应用移除（2026-06-05）。详见 status doc。
> 此文档保留为历史参考。

# Live2D Unified Protocol — Design Spec

> 日期: 2026-06-04 | 状态: draft | 参考: [live2d-sdk-parameter-reference.html](./live2d-sdk-parameter-reference.html)

## 一、目标

将 Live2D 从 mio (personal-agent) 中彻底解耦，成为独立 npm 包（Electron 桌面宠物）。定义一套与传输层无关、与智能体框架无关的统一控制协议，使任何 LLM 智能体都能通过标准消息格式调度 Live2D 的表情、动作和后台行为。

## 二、架构

```
┌─ Live2D Desktop SDK (Electron) ─────────────────────┐
│                                                       │
│  ┌─ Core 层 ───────────────────────────────────────┐ │
│  │  CubismFramework + CubismModel + PIXI 渲染      │ │
│  │  L1 表情引擎 / L2 动作引擎 / L3 后台模块         │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─ Protocol 层 ───────────────────────────────────┐ │
│  │  l2d.* 消息路由 + 模型发现 + 能力广播            │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─ Transport 层 ──────────────────────────────────┐ │
│  │  WebSocket Server (localhost:9228)               │ │
│  │  STDIO / IPC / HTTP (可选)                       │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ Adapter 层 (外部) ─────────────────────────────┐ │
│  │  MCP Adapter  │  Pi Adapter  │  Direct Connect   │ │
│  └─────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

- **Core 层**：基于 Cubism SDK 官方 Framework（CubismExpressionMotion / CubismMotion / CubismMotionManager），不绕过官方 API
- **Protocol 层**：传输无关的消息定义，8 条指令，请求→响应模式
- **Transport 层**：默认 WebSocket Hub，可替换为 STDIO/IPC/HTTP
- **Adapter 层**：按目标智能体框架提供包装器，不在核心包内

## 三、三层能力模型

### Layer 1 — 表情 (Expression)

LLM 通过语义名调用。每个模型的表情集不同，由 `model3.json → FileReferences.Expressions[]` 动态发现。

- **SDK 类**：`CubismExpressionMotion` + 独立 `CubismMotionManager`
- **数据源**：`.exp3.json` 文件
- **混合方式**：Add / Multiply / Overwrite（由 .exp3.json Blend 字段决定）
- **特点**：无时间变化（瞬切），不改变部件透明度

### Layer 2 — 动作 (Action)

LLM 通过语义名调用。基于标准参数的内置动作，跨模型通用。

- **SDK 类**：`CubismMotion` + 独立 `CubismMotionManager`
- **实现 A**：模型自带 .motion3.json（精确但模型特定）
- **实现 B**：SDK 内置参数序列（nod/wink/shake_head/tilt_head/slow_blink/double_blink — 所有模型通用）
- **特性**：FadeIn/FadeOut、Loop、优先级（PriorityNone/Idle/Normal/Force）、回调（Began/Finished）

### Layer 3 — 脚本 (Automation)

SDK 内置后台模块，LLM 不感知。L1/L2 触发时自动暂停/重置。

- **呼吸**：`CubismHarmonicMotionController` 驱动 ParamBreath（sin 波，3.5s 周期）
- **自动眨眼**：随机间歇（3-7s 间隔，ParamEyeLOpen/ParamEyeROpen）
- **随机视线**：ParamEyeBallX/Y 随机变化（2-5s 间隔）
- **头发物理**：`CubismPhysics` 驱动 `.physics3.json`
- **待机微表情**：空闲 >25s → 随机 L1 表情 → 3-5s 恢复
- **口型同步**：跟随音频/文本驱动 ParamMouthOpenY（可选）

## 四、协议消息定义

### 4.1 信封

```typescript
interface L2DMessage {
  type: string        // "l2d.{category}.{action}"
  payload: Record<string, unknown>
}
```

### 4.2 指令清单

```
L0 — 模型管理
  → l2d.model.load        { path: string }
  ← l2d.model.loaded      { ok: boolean, model?: string, error?: string }
  ↻ l2d.system.ready      { model, expressions: ExpressionDef[], actions: string[], parameters: string[] }
  ↻ l2d.system.bye        { reason }

L1 — 表情控制
  → l2d.expression.set   { name: string }
  ← l2d.expression.done  { name: string, ok: boolean, error?: string }
  → l2d.expression.list  {}
  ← l2d.expression.list  { expressions: ExpressionDef[] }

L2 — 动作控制
  → l2d.action.perform   { name: string, intensity?: number, count?: number }
  ← l2d.action.done      { name: string, ok: boolean, error?: string }
  → l2d.action.list      {}
  ← l2d.action.list      { actions: string[] }

L3 — 系统事件（仅 SDK 推送，不接受指令）
  ↻ l2d.system.heartbeat { fps: number, idleMs: number }
```

### 4.3 类型定义

```typescript
interface ExpressionDef {
  name: string        // 表情标识符 (e.g. "aixinyan")
  emoji?: string      // 渲染用 emoji (e.g. "🥰")
  description?: string // 语义描述 (e.g. "爱心眼 — 喜欢、心动")
}

interface ActionResult {
  name: string
  ok: boolean
  error?: string      // 失败时的原因
}

// → = 智能体发送到 SDK
// ← = SDK 响应到智能体
// ↻ = SDK 主动推送
```

### 4.4 设计规则

| 规则 | 说明 |
|------|------|
| 传输无关 | 同组消息适配 WebSocket / STDIO / IPC / HTTP |
| 请求→响应 | L1/L2 每条指令都有确认响应（非 fire-and-forget） |
| 无版本号 | 通过 `l2d.system.ready` 的能力集替代硬编码版本 |
| L3 透明 | LLM 不知道 L3 存在；L1/L2 触发后 L3 自动暂停/恢复 |
| 任意模型 | 通过 `l2d.model.load { path }` 手动指定目录加载；不自动扫描文件系统 |
| 无遗留协议 | 不兼容 v1/v2 旧格式，全新 l2d.* 协议，零技术债务 |

## 五、模型加载

### 5.1 设计原则

SDK 支持加载**任意** Live2D 模型，但**不自动扫描**文件系统。模型目录由用户/智能体通过指令显式指定。

- 启动时不加载任何模型
- 智能体发送 `l2d.model.load { path }` 后才加载
- 加载成功后广播 `l2d.system.ready`（含该模型的能力集）
- 切换模型只需再次发送 `l2d.model.load { path }`（自动卸载旧模型）

### 5.2 加载流程

```
1. 收到 → l2d.model.load { path: "/path/to/model/" }
2. SDK 读取 path/model.model3.json
   ├─ FileReferences.Expressions[] → L1 表情表
   ├─ FileReferences.Motions[]     → L2 动作分组
   ├─ FileReferences.Physics       → 物理文件（可选）
   └─ DisplayInfo (.cdi3.json)     → Parameters[]
3. 过滤标准参数 → L2 语义动作生成
4. 卸载旧模型（如有），创建 CubismModel 实例
5. 构建能力集 → 广播 ↻ l2d.system.ready
6. 启动 L3 后台模块
7. 进入主循环
```

### 5.3 能力集构建规则

从 .cdi3.json 的 Parameters[] 中过滤：

| 模式 | 用途 | 示例 |
|------|------|------|
| `^Param[A-Z]` | 标准参数 → L2 动作 | ParamAngleX, ParamEyeLOpen |
| `^Param\d+` | 自定义参数 → 内部 | Param68 (爱心眼), Param219 (星星眼) |
| `^Test_` | 调试参数 → 忽略 | Test_IN_ParamAngleZ |
| `^Param_Angle_Rotation` | 蒙皮参数 → 忽略 | Param_Angle_Rotation_1_ArtMesh3 |

## 六、适配器接口

核心包只暴露 transport 层。不同智能体框架通过适配器接入：

```
interface L2DAdapter {
  // 连接管理
  connect(): Promise<void>
  disconnect(): Promise<void>

  // 模型管理
  loadModel(path: string): Promise<{ ok: boolean; model?: string; error?: string }>

  // 指令接口
  setExpression(name: string): Promise<ActionResult>
  listExpressions(): Promise<ExpressionDef[]>
  performAction(name: string, opts?: { intensity?: number; count?: number }): Promise<ActionResult>
  listActions(): Promise<string[]>

  // 事件监听
  onReady(cb: (info: ModelInfo) => void): void
  onHeartbeat(cb: (info: { fps: number; idleMs: number }) => void): void
}
```

### 各框架适配方式

| 框架 | 适配器 | 连接方式 |
|------|--------|----------|
| Claude Code | MCP Server 包装为 tools | STDIO → WebSocket |
| Pi Agent | Pi Extension 包装为 tools | WebSocket 直连 |
| 原生接入 | 直接 WebSocket / IPC | ws://localhost:9228 |
| HTTP 接入 | REST API 桥接 | POST /l2d/expression/set |

适配器不在核心 npm 包内，作为独立 package 或 example 提供。

## 七、与现有代码的关系

| 现有模块 | 处理方式 |
|----------|----------|
| `frontend/src/extensions/live2d-view/` | **废弃**。独立包替代，从 mio 中删除 |
| `extensions/pa-live2d/` | **废弃**。改为 Pi Adapter 直连 WS Hub |
| `mcp-servers/live2d/` | **废弃**。改为 MCP Adapter 包装新协议 |
| `bridge/index.ts` L2D 中继 | **删除**。独立包自带 WS Hub |
| `bridge/handlers/message.ts` v1 live2d.control 兼容 | **删除**，不保留向后兼容 |
| `frontend/src/shell/live2d-signal.ts` | 迁移到独立包 |
| `frontend/src/extensions/settings-page/` Live2D 控制 | 移除，独立包自带配置界面 |
| `D:\claude\live2d-mcp/` | 独立包基础仓库 |

**mio 适配计划**：mio 侧改为 Pi Adapter → 直接连新 Hub (localhost:9228)，不再走 bridge → 浏览器链路。旧 v1 (`live2d.control`) 和 v2 (`live2d.expression` 等) 消息类型**全部移除**。

## 八、非目标 (Out of Scope)

- Godot 项目集成（mio-godot 是独立项目，不在此 spec 范围）
- LLM 自动情绪识别（表情自动匹配是后续 spec）
- Live2D 模型编辑/Creation
- 口型同步音频驱动（可选功能，不阻塞 v1）

## 九、成功标准

1. `npm install` 后可在 Electron 窗口独立启动 Live2D 桌面宠物（初始无模型）
2. 发送 `l2d.model.load { path }` 加载模型 → `l2d.expression.set { name }` 切换表情
3. L1/L2/L3 三层全部基于 Cubism SDK 官方 Framework 类（不绕过）
4. 换模型只需 `l2d.model.load { path }` → 自动卸载旧模型 → 加载新模型 → 广播新能力集
5. 现有 mio 项目可通过 Pi Adapter 过渡接入（不破坏现有功能）
