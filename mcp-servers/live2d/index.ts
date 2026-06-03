/**
 * 澪号 Live2D MCP Server
 *
 * 基于 Model Context Protocol (JSON-RPC 2.0)，通过 STDIO 通信。
 * Pi 的 mcporter 作为子进程启动本 server，自动发现 Live2D 工具。
 *
 * 工具：
 *   live2d_expression  — 切换表情
 *   live2d_motion      — 播放动作
 *   live2d_status      — 查询当前状态
 *
 * 传输：STDIO（stdin 读请求，stdout 写响应，stderr 写日志）
 */

import { WebSocket } from 'ws'
import { createInterface } from 'readline'

// ══════════════════════════════════════════════════════
// 表情/动作定义
// ══════════════════════════════════════════════════════

const EXPRESSIONS: Record<string, string> = {
  kongbai:     '空白 — 默认无表情，平静状态',
  aixinyan:    '爱心眼 — 喜欢、心动、被萌到',
  xingxingyan: '星星眼 — 兴奋、期待、眼睛发亮',
  lianhong:    '脸红 — 害羞、不好意思、被夸了',
  duzui:       '嘟嘴 — 撒娇、轻度不满、要说什么',
  guzui:       '鼓嘴 — 可爱、憋着话、忍住不说',
  han:         '汗 — 无奈、尴尬、无语',
  lei:         '泪 — 悲伤、感动哭了、难过',
  lianhei:     '脸黑 — 生气、暴躁、极度无语',
  lianqing:    '脸青 — 震惊、苍白、吓到了',
  yun:         '晕 — 头晕、受不了、被绕晕了',
  yuanquanyan: '圆圈眼 — 迷糊、晕头转向',
  xie:         '斜眼 — 怀疑、鄙视、不信任',
  jiantou:     '箭头 — 指向、强调、注意这里',
  xianhua:     '鲜花 — 赞美、庆祝、送你花',
  huatong:     '花筒 — 开心庆祝、party气氛',
  Scene1:      '场景动作 — 表情序列动画',
}

const MOTIONS: Record<string, string> = {
  // Scene1 为表情序列动画，已注册为 live2d_expression，请使用 live2d_motion 触发（前端会映射到 Scene1 表情）
}

// ══════════════════════════════════════════════════════
// JSON-RPC 辅助
// ══════════════════════════════════════════════════════

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number | string
  method: string
  params?: Record<string, unknown>
}

function ok(id: number | string | undefined, result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result })
}

function rpcErr(id: number | string | undefined, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })
}

function log(msg: string): void {
  process.stderr.write(`[mcp-live2d] ${msg}\n`)
}

// ══════════════════════════════════════════════════════
// 连接浏览器中的 Live2D 前端
// ══════════════════════════════════════════════════════

const BRIDGE_WS = 'ws://localhost:9229'
let ws: WebSocket | null = null
let pendingResolve: ((v: string) => void) | null = null

function connectBridge(): Promise<void> {
  return new Promise((resolve) => {
    ws = new WebSocket(BRIDGE_WS)
    ws.on('open', () => {
      log('connected to bridge')
      resolve()
    })
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'live2d.result' && pendingResolve) {
        pendingResolve(msg.payload?.text ?? '')
        pendingResolve = null
      }
    })
    ws.on('close', () => { log('bridge disconnected'); ws = null })
  })
}

async function _sendToBrowser(tool: string, args: Record<string, string>): Promise<string> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    await connectBridge()
  }

  return new Promise((resolve) => {
    pendingResolve = resolve
    ws!.send(JSON.stringify({
      type: 'live2d.control',
      id: `mcp-${Date.now()}`,
      sessionId: '',
      ts: Date.now(),
      payload: { tool, args },
    }))
    // 超时 3 秒
    setTimeout(() => {
      if (pendingResolve) {
        pendingResolve = null
        resolve('Live2D 未响应（前端未连接或模型未加载）')
      }
    }, 3000)
  })
}

// ══════════════════════════════════════════════════════
// 工具定义
// ══════════════════════════════════════════════════════

const TOOLS = [
  {
    name: 'live2d_expression',
    description:
      '切换澪号的 Live2D 表情。根据当前情绪选择合适的表情名称。' +
      '可用表情：' +
      Object.entries(EXPRESSIONS).map(([k, v]) => `${k}(${v.split('—')[0].trim()})`).join('、'),
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '表情名称（拼音）。可选: ' + Object.keys(EXPRESSIONS).join(', '),
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'live2d_motion',
    description:
      '播放澪号的 Live2D 动作。目前可用动作：' +
      Object.entries(MOTIONS).map(([k, v]) => `${k}(${v})`).join('、'),
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '动作名称。可选: ' + Object.keys(MOTIONS).join(', '),
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'live2d_status',
    description: '获取澪号当前 Live2D 状态：模型名称、当前表情、可用表情列表、可用动作列表',
    inputSchema: { type: 'object', properties: {} },
  },
]

// ══════════════════════════════════════════════════════
// 路由
// ══════════════════════════════════════════════════════

export type SendFn = (tool: string, args: Record<string, string>) => Promise<string>

export async function handleRequest(
  req: JsonRpcRequest,
  sendToBrowser: SendFn = _sendToBrowser,
): Promise<string> {
  const { id, method, params } = req

  switch (method) {
    // ── 初始化 ──
    case 'initialize':
      return ok(id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'mio-live2d', version: '0.1.0' },
        capabilities: { tools: {} },
      })

    // ── 工具发现 ──
    case 'tools/list':
      return ok(id, { tools: TOOLS })

    // ── 工具调用 ──
    case 'tools/call': {
      const toolName = params?.name as string
      const toolArgs = (params?.arguments ?? {}) as Record<string, string>

      if (!toolName) return rpcErr(id, -32602, 'Missing tool name')

      switch (toolName) {
        case 'live2d_expression': {
          const exprName = toolArgs.name
          if (!exprName || !EXPRESSIONS[exprName]) {
            return rpcErr(id, -32602,
              `未知表情: ${exprName}。可用: ${Object.keys(EXPRESSIONS).join(', ')}`)
          }
          const result = await sendToBrowser('live2d_expression', { name: exprName })
          return ok(id, { content: [{ type: 'text', text: result || `表情已切换: ${EXPRESSIONS[exprName]}` }] })
        }

        case 'live2d_motion': {
          const motionName = toolArgs.name
          // Scene1 是表情序列动画，前端会映射到 Scene1 表情
          if (!motionName || motionName !== 'Scene1') {
            return rpcErr(id, -32602, `未知动作: ${motionName}。可用: Scene1（表情序列）`)
          }
          const result = await sendToBrowser('live2d_motion', { name: motionName })
          return ok(id, { content: [{ type: 'text', text: result || '动作已播放: Scene1（表情序列）' }] })
        }

        case 'live2d_status': {
          const statusText =
            `模型: 卡拉\n` +
            `可用表情(${Object.keys(EXPRESSIONS).length}): ${Object.keys(EXPRESSIONS).join(', ')}\n` +
            `可用动作(${Object.keys(MOTIONS).length}): ${Object.keys(MOTIONS).join(', ')}`
          return ok(id, { content: [{ type: 'text', text: statusText }] })
        }

        default:
          return rpcErr(id, -32601, `Unknown tool: ${toolName}`)
      }
    }

    // ── 心跳/能力检查 ──
    case 'ping':
      return ok(id, {})

    // ── 通知（无 id，不响应）──
    case 'initialized':
    case 'notifications/initialized':
      return '' // 不响应

    default:
      return rpcErr(id, -32601, `Unknown method: ${method}`)
  }
}

// ══════════════════════════════════════════════════════
// 导出（供测试用）
// ══════════════════════════════════════════════════════

export { EXPRESSIONS, MOTIONS, TOOLS }
export { ok, rpcErr }

// ══════════════════════════════════════════════════════
// STDIO 传输
// ══════════════════════════════════════════════════════

async function main() {
  log('Live2D MCP Server starting...')

  const rl = createInterface({ input: process.stdin })

  rl.on('line', async (line) => {
    try {
      const req: JsonRpcRequest = JSON.parse(line.trim())
      const response = await handleRequest(req)
      if (response) process.stdout.write(response + '\n')
    } catch (e) {
      log(`parse error: ${e}`)
    }
  })

  rl.on('close', () => {
    log('stdin closed, exiting')
    ws?.close()
    process.exit(0)
  })
}

// 仅在直接运行时启动 STDIO 监听（import 时不执行）
if (process.argv[1]?.includes('index')) {
  main()
}
