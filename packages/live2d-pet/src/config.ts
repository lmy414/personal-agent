import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import * as readline from 'node:readline'
import type { Live2DMCPConfig } from './types.js'

const CONFIG_DIR = path.join(os.homedir(), '.live2d-mcp')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

const DEFAULTS: Partial<Live2DMCPConfig> = {
  ws: { port: 9228, host: '127.0.0.1' },
}

export function configPath(): string {
  return CONFIG_PATH
}

export function readConfig(): Live2DMCPConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `配置文件不存在: ${CONFIG_PATH}\n请先运行 live2d-mcp init 创建配置`,
    )
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as Partial<Live2DMCPConfig>

  if (!parsed.model?.path || typeof parsed.model.path !== 'string') {
    throw new Error('配置文件缺少 model.path 字段')
  }
  if (!fs.existsSync(parsed.model.path)) {
    throw new Error(`模型文件不存在: ${parsed.model.path}`)
  }

  const wsPort = parsed.ws?.port ?? DEFAULTS.ws!.port
  const wsHost = parsed.ws?.host ?? DEFAULTS.ws!.host

  return {
    model: { path: parsed.model.path },
    ws: { port: wsPort, host: wsHost },
  }
}

export async function initConfig(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve))

  console.log('Live2D MCP — 首次配置\n')

  const modelPath = await question('请输入 model3.json 的绝对路径: ')
  const resolved = path.resolve(modelPath.trim())

  if (!fs.existsSync(resolved)) {
    console.error(`错误: 文件不存在 — ${resolved}`)
    rl.close()
    process.exit(1)
  }

  if (!resolved.endsWith('.model3.json')) {
    console.warn('警告: 文件名不以 .model3.json 结尾，请确认这是有效的 Cubism 模型文件')
  }

  const config: Live2DMCPConfig = {
    model: { path: resolved },
    ws: { port: 9228, host: '127.0.0.1' },
  }

  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')

  console.log(`\n配置已写入: ${CONFIG_PATH}`)
  console.log(`模型路径: ${resolved}`)
  console.log(`\n现在可以运行 live2d-mcp start 启动服务`)

  rl.close()
}
