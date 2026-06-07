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

/**
 * MCP Server 配置列表。
 * Live2D 已于 2026-06-07 清理。添加新的 MCP server 时在此数组中追加配置。
 * 每个 server 需提供 command/args/tools（预定义工具列表，避免依赖异步 tools/list）。
 */
const SERVERS: MCPServer[] = []

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
        console.log('[pa-mcp] MCP connected')
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

  const count = SERVERS.reduce((sum, s) => sum + s.tools.length, 0)
  console.log(`[pa-mcp] ${count} tools registered (lazy MCP init)`)
}
