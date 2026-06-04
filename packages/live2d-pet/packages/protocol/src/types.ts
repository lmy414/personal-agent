// ============================================================
// Live2D Desktop Pet — Unified Protocol Types
//
// 传输无关。所有智能体框架通过适配器使用这些类型。
// 9 条指令: model.load / expression.set / expression.list /
//           action.perform / action.list / system.* events
// ============================================================

// ── 信封 ──────────────────────────────────────────────

export type L2DType =
  // L0: 模型管理
  | 'l2d.model.load'
  | 'l2d.model.loaded'
  // L1: 表情
  | 'l2d.expression.set'
  | 'l2d.expression.done'
  | 'l2d.expression.list'
  // L2: 动作
  | 'l2d.action.perform'
  | 'l2d.action.done'
  | 'l2d.action.list'
  // L3: 系统事件
  | 'l2d.system.ready'
  | 'l2d.system.bye'
  | 'l2d.system.heartbeat'

/** 统一消息信封 */
export interface L2DMessage<T extends L2DType = L2DType, P = unknown> {
  type: T
  payload: P
}

// ── Domain Types ───────────────────────────────────────

export interface ExpressionDef {
  /** 表情标识符 (e.g. "aixinyan") — 对应 .exp3.json 文件名 */
  name: string
  /** 渲染用 emoji */
  emoji?: string
  /** 语义描述 */
  description?: string
}

export interface ActionResult {
  name: string
  ok: boolean
  /** ok=false 时的错误信息 */
  error?: string
}

export interface ModelInfo {
  /** 模型名（取自 model3.json → FileReferences.Expressions 首个文件或目录名） */
  model: string
  /** 该模型支持的表情列表 */
  expressions: ExpressionDef[]
  /** 该模型支持的语义动作（基于标准参数自动生成） */
  actions: string[]
  /** 该模型暴露的标准参数 ID 列表 */
  parameters: string[]
}

// ── L0: 模型管理 ──────────────────────────────────────

export interface ModelLoadPayload {
  /** 模型目录的绝对路径，包含 .model3.json */
  path: string
}

export interface ModelLoadedPayload {
  ok: boolean
  model?: string
  error?: string
}

// ── L1: 表情 ──────────────────────────────────────────

export interface ExpressionSetPayload {
  /** 表情名称，对应 .exp3.json 文件名 */
  name: string
}

export interface ExpressionListPayload {
  expressions: ExpressionDef[]
}

// ── L2: 动作 ──────────────────────────────────────────

export interface ActionPerformPayload {
  /** 动作名: nod | wink | slow_blink | double_blink | shake_head | tilt_head */
  name: string
  /** 强度: 0.0~1.0，默认 1.0。影响参数幅度 */
  intensity?: number
  /** 重复次数，默认 1 */
  count?: number
}

export interface ActionListPayload {
  actions: string[]
}

// ── L3: 系统事件 (SDK → 外部) ─────────────────────────

export interface HeartbeatPayload {
  fps: number
  /** 距离上次交互的空闲毫秒数 */
  idleMs: number
}

export interface SystemByePayload {
  reason: string
}

// ── Discriminated Union ────────────────────────────────

/** 所有入站消息 (智能体 → SDK) */
export type InboundMessage =
  | L2DMessage<'l2d.model.load', ModelLoadPayload>
  | L2DMessage<'l2d.expression.set', ExpressionSetPayload>
  | L2DMessage<'l2d.expression.list', Record<string, never>>
  | L2DMessage<'l2d.action.perform', ActionPerformPayload>
  | L2DMessage<'l2d.action.list', Record<string, never>>

/** 所有出站消息 (SDK → 智能体) */
export type OutboundMessage =
  | L2DMessage<'l2d.model.loaded', ModelLoadedPayload>
  | L2DMessage<'l2d.expression.done', ActionResult>
  | L2DMessage<'l2d.expression.list', ExpressionListPayload>
  | L2DMessage<'l2d.action.done', ActionResult>
  | L2DMessage<'l2d.action.list', ActionListPayload>
  | L2DMessage<'l2d.system.ready', ModelInfo>
  | L2DMessage<'l2d.system.bye', SystemByePayload>
  | L2DMessage<'l2d.system.heartbeat', HeartbeatPayload>

/** 所有消息的联合 */
export type AnyL2DMessage = InboundMessage | OutboundMessage

// ── 常量 ───────────────────────────────────────────────

/** L2 内置语义动作（基于标准参数，所有模型通用） */
export const BUILTIN_ACTIONS = [
  'nod',
  'shake_head',
  'tilt_head',
  'wink',
  'slow_blink',
  'double_blink',
] as const

export type BuiltinAction = (typeof BUILTIN_ACTIONS)[number]

/** 标准参数 ID 前缀正则（用于从 .cdi3.json 过滤） */
export const STANDARD_PARAM_RE = /^Param[A-Z]/

/** 应忽略的参数 ID 正则 */
export const SKIP_PARAM_RE = /^Test_|^Param_Angle_Rotation/
