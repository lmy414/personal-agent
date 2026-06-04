/**
 * MCP Adapter — STDIO ↔ WS Hub bridge
 *
 * Claude Desktop launches this via STDIO.
 * This connects to WS Hub (localhost:9228) and forwards all commands.
 *
 * 5 tools → l2d.* messages:
 *   model_load      → l2d.model.load
 *   expression_set  → l2d.expression.set
 *   expression_list → l2d.expression.list
 *   action_perform  → l2d.action.perform
 *   action_list     → l2d.action.list
 */

import { createInterface } from 'node:readline'
import { WebSocket } from 'ws'
import { parseRequest, ok, err, format, ErrorCode } from './json-rpc'
import { MCP_TOOLS } from './tools'

const HUB_URL = 'ws://localhost:9228'

// ── WS Hub Connection ───────────────────────────────

let ws: WebSocket | null = null
const pending = new Map<number, (msg: any) => void>()
let ridCounter = 0

function connectHub(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(HUB_URL)
    socket.on('open', () => {
      process.stderr.write('[mcp] connected to WS Hub\n')
      ws = socket
      resolve(socket)
    })
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg._rid !== undefined && pending.has(msg._rid)) {
          pending.get(msg._rid)!(msg)
          pending.delete(msg._rid)
        }
      } catch { /* ignore */ }
    })
    socket.on('close', () => { process.stderr.write('[mcp] WS Hub disconnected\n') })
    socket.on('error', (e) => { reject(e) })
    setTimeout(() => reject(new Error('WS Hub connection timeout')), 5000)
  })
}

function sendToHub(type: string, payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WS Hub not connected — 请先启动 Desktop Pet'))
      return
    }
    const _rid = ++ridCounter
    pending.set(_rid, resolve)
    ws.send(JSON.stringify({ type, payload, _rid }))
    setTimeout(() => {
      if (pending.has(_rid)) { pending.delete(_rid); reject(new Error(`timeout: ${type}`)) }
    }, 5000)
  })
}

// ── Tool name → l2d type mapping ────────────────────

const TOOL_TO_L2D: Record<string, (args: Record<string, unknown>) => { type: string; payload: unknown }> = {
  model_load: (args) => ({
    type: 'l2d.model.load',
    payload: { path: args.path },
  }),
  expression_set: (args) => ({
    type: 'l2d.expression.set',
    payload: { name: args.name },
  }),
  expression_list: () => ({
    type: 'l2d.expression.list',
    payload: {},
  }),
  action_perform: (args) => ({
    type: 'l2d.action.perform',
    payload: { name: args.name, intensity: args.intensity, count: args.count },
  }),
  action_list: () => ({
    type: 'l2d.action.list',
    payload: {},
  }),
  settings_get: () => ({
    type: 'l2d.settings.get',
    payload: {},
  }),
  settings_set: (args) => ({
    type: 'l2d.settings.set',
    payload: args,
  }),
}

// ── STDIO Server ────────────────────────────────────

async function createServer() {
  try {
    await connectHub()
  } catch (e) {
    process.stderr.write(`[mcp] failed to connect WS Hub: ${e}\n`)
  }

  const rl = createInterface({ input: process.stdin })

  rl.on('line', (line) => {
    const req = parseRequest(line)
    if (!req) {
      process.stdout.write(format(err(undefined, ErrorCode.PARSE_ERROR, 'Invalid JSON-RPC')) + '\n')
      return
    }

    const { id, method, params } = req

    switch (method) {
      case 'initialize':
        process.stdout.write(format(ok(id, {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'live2d-desktop-pet', version: '0.1.0' },
          capabilities: { tools: {} },
        })) + '\n')
        break

      case 'tools/list':
        process.stdout.write(format(ok(id, { tools: MCP_TOOLS })) + '\n')
        break

      case 'tools/call': {
        const toolName = params?.name as string
        const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>

        if (!toolName) {
          process.stdout.write(format(err(id, ErrorCode.INVALID_PARAMS, 'Missing tool name')) + '\n')
          return
        }

        const mapper = TOOL_TO_L2D[toolName]
        if (!mapper) {
          process.stdout.write(format(err(id, ErrorCode.METHOD_NOT_FOUND, `Unknown tool: ${toolName}`)) + '\n')
          return
        }

        const { type, payload } = mapper(toolArgs)

        if (!ws || ws.readyState !== WebSocket.OPEN) {
          process.stdout.write(format(
            ok(id, { content: [{ type: 'text', text: 'Live2D Desktop Pet 未启动。请先启动 Electron 应用 (ws://localhost:9228)。' }], isError: true })
          ) + '\n')
          return
        }

        sendToHub(type, payload).then((result: any) => {
          // Convert l2d response back to MCP tool result text
          const text = formatToolResult(toolName, result)
          process.stdout.write(format(ok(id, { content: [{ type: 'text', text }] })) + '\n')
        }).catch((e) => {
          process.stdout.write(format(err(id, ErrorCode.INTERNAL_ERROR, String(e))) + '\n')
        })
        break
      }

      case 'notifications/initialized':
      case 'initialized':
        break

      case 'ping':
        process.stdout.write(format(ok(id, {})) + '\n')
        break

      default:
        process.stdout.write(format(err(id, ErrorCode.METHOD_NOT_FOUND, `Unknown method: ${method}`)) + '\n')
    }
  })

  rl.on('close', () => {
    process.stderr.write('[mcp] stdin closed, exiting\n')
    ws?.close()
    process.exit(0)
  })
}

// ── Response Formatter ──────────────────────────────

function formatToolResult(tool: string, result: any): string {
  const p = result.payload ?? result
  switch (tool) {
    case 'model_load':
      if (p.ok) return `模型已加载: ${p.model}`
      return `加载失败: ${p.error}`
    case 'expression_set':
      return p.ok ? `表情已切换: ${p.name}` : `表情切换失败: ${p.error}`
    case 'expression_list': {
      const exps = p.expressions ?? []
      if (exps.length === 0) return '未加载模型，请先 model_load'
      return `可用表情(${exps.length}):\n${exps.map((e: any) => `${e.name}${e.emoji ? ' ' + e.emoji : ''} — ${e.description ?? ''}`).join('\n')}`
    }
    case 'action_perform':
      return p.ok ? `动作已执行: ${p.name}` : `动作执行失败: ${p.error}`
    case 'action_list': {
      const acts = p.actions ?? []
      return acts.length === 0 ? '未加载模型，请先 model_load' : `可用动作: ${acts.join(', ')}`
    }
    case 'settings_get':
    case 'settings_set':
      return `当前设置:\n` + JSON.stringify(p, null, 2)
    default:
      return JSON.stringify(result)
  }
}

// ── Entry ───────────────────────────────────────────

export { createServer, TOOL_TO_L2D, formatToolResult }

if (process.argv[1]?.includes('index')) {
  createServer()
}
