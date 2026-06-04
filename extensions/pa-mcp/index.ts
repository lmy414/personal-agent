/**
 * pa-mcp — Generic MCP Client Bridge
 *
 * 启动 MCP server 子进程（STDIO JSON-RPC），自动发现工具并注册到 Pi。
 * 任何兼容 MCP 的服务都可以通过配置接入，不限于 Live2D。
 */
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { defineTool } from '@mariozechner/pi-coding-agent'
import { Type } from '@mariozechner/pi-ai'
import { spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'

interface MCPConfig {
  command: string
  args: string[]
  env?: Record<string, string>
}

interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

const SERVERS: MCPConfig[] = [
  {
    command: 'npx',
    args: ['tsx', 'D:/claude/personal-agent/packages/live2d-pet/packages/adapters/mcp/src/index.ts'],
  },
]

// ── MCP Client ────────────────────────────────

class MCPClient {
  private proc: ChildProcess | null = null
  private rid = 0
  private pending = new Map<number, (result: unknown) => void>()
  private tools: MCPTool[] = []

  async start(cfg: MCPConfig): Promise<MCPTool[]> {
    this.proc = spawn(cfg.command, cfg.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...cfg.env },
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

    // Initialize
    const initResult = await this._call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'pa-mcp', version: '1.0' },
    })

    if (!initResult) throw new Error('MCP initialize failed')

    // Send initialized notification
    this._notify('notifications/initialized', {})

    // Discover tools
    const toolsResult = await this._call('tools/list', {})
    this.tools = (toolsResult as any)?.tools ?? []

    return this.tools
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this._call('tools/call', { name, arguments: args })
    const content = (result as any)?.content
    if (Array.isArray(content)) {
      return content.map((c: any) => c.text ?? '').join('\n')
    }
    return JSON.stringify(result)
  }

  private _call(method: string, params: unknown): Promise<unknown> {
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

  private _notify(method: string, params: unknown): void {
    this.proc!.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
  }

  close(): void {
    this.proc?.kill()
    this.proc = null
  }
}

// ── Schema Mapping ────────────────────────────

/** 将 JSON Schema 映射为 Pi Type */
function toPiType(tool: MCPTool): any {
  const props = tool.inputSchema.properties ?? {}
  const required = tool.inputSchema.required ?? []
  const obj: Record<string, any> = {}
  for (const [key, val] of Object.entries(props)) {
    const p = val as { type?: string; description?: string }
    if (p.type === 'number') {
      obj[key] = Type.Number({ description: p.description })
    } else if (p.type === 'boolean') {
      obj[key] = Type.Boolean({ description: p.description })
    } else {
      obj[key] = Type.String({ description: p.description })
    }
    // Mark as optional if not in required
    if (!required.includes(key)) {
      obj[key] = Type.Optional(obj[key])
    }
  }
  return Type.Object(obj)
}

// ── Register ──────────────────────────────────

export default async function register(api: ExtensionAPI) {
  for (const cfg of SERVERS) {
    const client = new MCPClient()
    try {
      const tools = await client.start(cfg)
      console.log(`[pa-mcp] ${cfg.command} → ${tools.length} tools`)

      for (const tool of tools) {
        const piTool = defineTool({
          name: tool.name,
          label: tool.name,
          description: tool.description,
          parameters: toPiType(tool),
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
    } catch (e: any) {
      console.error(`[pa-mcp] ${cfg.command} 启动失败: ${e.message}`)
    }
  }

  console.log('[pa-mcp] MCP bridge ready')
}
