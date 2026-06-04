/**
 * pa-mcp — Generic MCP Client Bridge
 *
 * 启动 MCP server 子进程（STDIO JSON-RPC），将工具注册到 Pi。
 * register() 同步返回（Pi 不 await），MCP client 懒初始化。
 */
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { defineTool } from '@mariozechner/pi-coding-agent'
import { Type } from '@mariozechner/pi-ai'
import { spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Config ─────────────────────────────────────

interface MCPServer {
  command: string
  args: string[]
  /** 预定义工具列表（避免依赖异步 tools/list） */
  tools: PreDefTool[]
}

interface PreDefTool {
  name: string
  description: string
  params: Record<string, { type: 'string' | 'number' | 'boolean'; required: boolean; description: string }>
}

/** 解析项目根目录（extensions/pa-mcp/index.ts → ../../） */
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** 硬编码工具定义 — 与 MCP adapter tools.ts 保持同步 */
const SERVERS: MCPServer[] = [
  {
    command: 'node',
    args: [
      resolve(PROJECT_ROOT, 'bridge/node_modules/tsx/dist/cli.mjs'),
      resolve(PROJECT_ROOT, 'packages/live2d-pet/packages/adapters/mcp/src/index.ts'),
    ],
    tools: [
      {
        name: 'model_load',
        description:
          '加载 Live2D 模型。指定包含 .model3.json 的目录绝对路径。加载后自动发现表情和动作列表。',
        params: {
          path: { type: 'string', required: true, description: '模型目录的绝对路径，必须包含 .model3.json 文件' },
        },
      },
      {
        name: 'expression_set',
        description:
          '切换 Live2D 角色的表情。可用表情通过 expression_list 获取（需先 model_load）。',
        params: {
          name: { type: 'string', required: true, description: '表情名称，对应 .exp3.json 文件名（不含扩展名）' },
        },
      },
      {
        name: 'expression_list',
        description: '列出当前模型的所有可用表情及描述。需先 model_load。',
        params: {},
      },
      {
        name: 'action_perform',
        description:
          '播放语义动作。可用: nod(点头)、shake_head(摇头)、tilt_head(歪头)、wink(单眼眨)、slow_blink(慢眨眼)、double_blink(双眨眼)。',
        params: {
          name: { type: 'string', required: true, description: 'nod / shake_head / tilt_head / wink / slow_blink / double_blink' },
          intensity: { type: 'number', required: false, description: '强度 0.0~1.0，默认 1.0' },
          count: { type: 'number', required: false, description: '重复次数，默认 1' },
        },
      },
      {
        name: 'action_list',
        description: '列出所有可用的语义动作。所有模型通用。',
        params: {},
      },
      {
        name: 'settings_get',
        description: '获取 Live2D 桌面宠物所有当前设置。',
        params: {},
      },
      {
        name: 'settings_set',
        description:
          '修改桌面宠物设置。可修改: window.width/height/x/y/opacity, model.scale/offsetX/offsetY/visible。',
        params: {
          'window.width': { type: 'number', required: false, description: '窗口宽度 (200-600)' },
          'window.height': { type: 'number', required: false, description: '窗口高度 (260-800)' },
          'window.opacity': { type: 'number', required: false, description: '窗口透明度 (0.3-1.0)' },
          'model.scale': { type: 'number', required: false, description: '模型缩放 (0=自动)' },
          'model.offsetX': { type: 'number', required: false, description: '模型横向偏移 (-200~200)' },
          'model.offsetY': { type: 'number', required: false, description: '模型纵向偏移 (-200~200)' },
          'model.visible': { type: 'boolean', required: false, description: '模型是否可见' },
        },
      },
    ],
  },
]

// ── MCP Client (lazy singleton) ────────────────

class MCPClient {
  private proc: ChildProcess | null = null
  private rid = 0
  private pending = new Map<number, (v: unknown) => void>()
  private started = false
  private startPromise: Promise<void> | null = null

  /** 懒启动：首次工具调用时自动连接 MCP adapter */
  private async ensureStarted(): Promise<void> {
    if (this.started) return
    if (this.startPromise) return this.startPromise

    this.startPromise = this._doStart()
    await this.startPromise
    this.started = true
  }

  private async _doStart(): Promise<void> {
    const cfg = SERVERS[0]
    return new Promise((resolve, reject) => {
      this.proc = spawn(cfg.command, cfg.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      })

      const rl = createInterface({ input: this.proc.stdout! })
      rl.on('line', (line) => {
        try {
          const msg = JSON.parse(line)
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            this.pending.get(msg.id)!(msg)
            this.pending.delete(msg.id)
          }
        } catch { /* ignore */ }
      })

      this.proc.stderr?.on('data', (d) => {
        process.stderr.write(`[pa-mcp] ${d}`)
      })

      this.proc.on('error', (e) => reject(e))

      // Initialize handshake
      this._callRpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'pa-mcp', version: '1.0' },
      }).then((initResult) => {
        if (!initResult) return reject(new Error('MCP initialize 无响应'))
        this._notifyRpc('notifications/initialized', {})
        console.log('[pa-mcp] MCP connected, 7 tools registered')
        resolve()
      }).catch(reject)
    })
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    await this.ensureStarted()
    const result = await this._callRpc('tools/call', { name, arguments: args })
    const content = (result as any)?.content
    if (Array.isArray(content)) {
      return content.map((c: any) => c.text ?? '').join('\n')
    }
    return JSON.stringify(result)
  }

  private _callRpc(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.rid
      this.pending.set(id, resolve)
      this.proc!.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`MCP timeout: ${method}`))
        }
      }, 15000)
    })
  }

  private _notifyRpc(method: string, params: unknown): void {
    this.proc!.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
  }
}

// ── Type mapping ───────────────────────────────

function toPiParams(def: PreDefTool['params']): any {
  if (Object.keys(def).length === 0) return Type.Object({})
  const obj: Record<string, any> = {}
  for (const [key, p] of Object.entries(def)) {
    if (p.type === 'number') {
      obj[key] = Type.Number({ description: p.description })
    } else if (p.type === 'boolean') {
      obj[key] = Type.Boolean({ description: p.description })
    } else {
      obj[key] = Type.String({ description: p.description })
    }
    if (!p.required) obj[key] = Type.Optional(obj[key])
  }
  return Type.Object(obj)
}

// ── Register (SYNCHRONOUS) ─────────────────────

export default function register(api: ExtensionAPI): void {
  const client = new MCPClient()

  for (const server of SERVERS) {
    for (const tool of server.tools) {
      const piTool = defineTool({
        name: tool.name,
        label: tool.name,
        description: tool.description,
        parameters: toPiParams(tool.params),
        execute: async (_id, params) => {
          try {
            const text = await client.callTool(tool.name, params as Record<string, unknown>)
            return { content: [{ type: 'text' as const, text }], details: {} }
          } catch (e: any) {
            return { content: [{ type: 'text' as const, text: `MCP 错误: ${e.message}` }], details: {} }
          }
        },
      })
      api.registerTool(piTool)
    }
  }

  console.log('[pa-mcp] 7 tools registered (lazy MCP init)')
}
