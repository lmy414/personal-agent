#!/usr/bin/env node
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readConfig, initConfig } from './config.js'
import { readModelManifest } from './model-reader.js'
import { startOrConnectWS } from './ws-hub.js'
import { startServer } from './server.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const USAGE = `Live2D MCP — 通用 Live2D 控制服务

用法:
  live2d-mcp init     创建配置文件 (~/.live2d-mcp/config.json)
  live2d-mcp start    启动 MCP Server（STDIO 模式）
  live2d-mcp --help   显示帮助
  live2d-mcp version  显示版本
`

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'start'

  if (cmd === '--help' || cmd === '-h') {
    console.log(USAGE)
    return
  }

  if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    const pkgPath = path.join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version: string }
    console.log(pkg.version)
    return
  }

  if (cmd === 'init') {
    await initConfig()
    return
  }

  if (cmd === 'start') {
    const config = readConfig()
    const manifest = readModelManifest(config.model.path)
    const wsHub = await startOrConnectWS(config.ws.port, config.ws.host)
    startServer(manifest, wsHub)
    return
  }

  if (cmd === 'test') {
    // Dynamic import to avoid loading REPL deps for start/init
    const { runTestRepl } = await import('./test-repl.js')
    await runTestRepl()
    return
  }

  console.error(`未知命令: ${cmd}\n${USAGE}`)
  process.exit(1)
}

main().catch((err) => {
  console.error(`[live2d-mcp] 启动失败: ${(err as Error).message}`)
  process.exit(1)
})
