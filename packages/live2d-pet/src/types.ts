// ═══════════════════════════════════════
// 配置
// ═══════════════════════════════════════

export interface Live2DMCPConfig {
  model: { path: string }
  ws: { port: number; host: string }
}

// ═══════════════════════════════════════
// 模型元数据（从 model3.json 解析）
// ═══════════════════════════════════════

export interface ExpressionRef {
  name: string   // .exp3.json 文件名去后缀
  file: string   // 相对路径（相对于 model3.json 所在目录）
}

export interface MotionGroupRef {
  name: string
  files: string[]
}

export interface GroupRef {
  name: string    // 如 "EyeBlink", "LipSync"
  ids: string[]   // 该组的参数 ID 列表
}

export interface Groups {
  eyeBlink?: GroupRef
  lipSync?: GroupRef
}

export interface ModelManifest {
  name: string
  expressions: ExpressionRef[]
  motions: MotionGroupRef[]
  groups: Groups      // 从 model3.json Groups 字段解析
  rawPath: string     // model3.json 绝对路径
  baseDir: string     // model3.json 父目录
}

// ═══════════════════════════════════════
// 渲染指令 → WebSocket 广播
// ═══════════════════════════════════════

export interface ParameterCommand {
  id: string
  value: number
  duration?: number   // ms，默认 0（立即）
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
}

/** 通过 WS 发送给渲染器的广播消息 */
export type WSBroadcast =
  | { type: 'expression'; name: string }                                  // 渲染器加载 .exp3.json
  | { type: 'motion'; group: string; index: number }                      // 渲染器加载 .motion3.json
  | { type: 'parameter'; params: ParameterCommand[] }                     // 直接参数操控
  | { type: 'animate'; animation: string; params: ParameterCommand[] }    // 语义动画
  | { type: 'l2d.model.load'; payload: { path: string } }                 // 模型加载

// ═══════════════════════════════════════
// MCP JSON-RPC
// ═══════════════════════════════════════

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number | string
  method: string
  params?: Record<string, unknown>
}

export interface MCPToolDef {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface MCPCallResult {
  content: Array<{ type: 'text'; text: string }>
}
