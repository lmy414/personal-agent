import { createInterface } from 'node:readline'
import type { JsonRpcRequest } from './types.js'
import type { ModelManifest } from './types.js'
import type { WSHub } from './ws-hub.js'
import { createTools, dispatchTool } from './tools.js'

function ok(id: number | string | undefined, result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result })
}

function rpcErr(id: number | string | undefined, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })
}

function log(msg: string): void {
  process.stderr.write(`[live2d-mcp] ${msg}\n`)
}

export function startServer(manifest: ModelManifest, wsHub: WSHub): void {
  const tools = createTools(manifest, wsHub)
  log(`模型: ${manifest.name}`)
  log(`表情: ${manifest.expressions.length} 个`)
  log(`动作组: ${manifest.motions.length} 个`)
  if (manifest.groups.eyeBlink) log(`眨眼组: ${manifest.groups.eyeBlink.ids.join(', ')}`)
  if (manifest.groups.lipSync) log(`唇形组: ${manifest.groups.lipSync.ids.join(', ')}`)
  log(`MCP Server 已启动，等待 STDIO 连接...`)

  // 广播模型加载指令到渲染器
  wsHub.broadcast({
    type: 'l2d.model.load',
    payload: { path: manifest.baseDir },
  })
  log(`已发送模型加载指令: ${manifest.baseDir}`)

  const rl = createInterface({ input: process.stdin })

  rl.on('line', (line: string) => {
    let req: JsonRpcRequest
    try {
      req = JSON.parse(line.trim())
    } catch {
      log(`JSON 解析失败: ${line.slice(0, 80)}`)
      return
    }

    const { id, method, params } = req

    try {
      switch (method) {
        case 'initialize':
          process.stdout.write(
            ok(id, {
              protocolVersion: '2024-11-05',
              serverInfo: { name: 'live2d-mcp', version: '0.1.0' },
              capabilities: { tools: {} },
            }) + '\n',
          )
          break

        case 'tools/list':
          process.stdout.write(ok(id, { tools }) + '\n')
          break

        case 'tools/call': {
          const toolName = params?.name as string | undefined
          const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>

          if (!toolName) {
            process.stdout.write(rpcErr(id, -32602, 'Missing tool name') + '\n')
            return
          }

          const result = dispatchTool(toolName, toolArgs, manifest, wsHub)
          process.stdout.write(ok(id, result) + '\n')
          break
        }

        case 'ping':
          process.stdout.write(ok(id, {}) + '\n')
          break

        // Notifications (no id) — no response
        case 'initialized':
        case 'notifications/initialized':
          break

        default:
          process.stdout.write(rpcErr(id, -32601, `Unknown method: ${method}`) + '\n')
      }
    } catch (err) {
      log(`处理 ${method} 时出错: ${(err as Error).message}`)
      process.stdout.write(rpcErr(id, -32603, 'Internal error') + '\n')
    }
  })

  rl.on('close', () => {
    log('stdin closed — WS hub 保持运行')
    // 不退出：WS hub 继续服务渲染器连接
  })
}
