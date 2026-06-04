/**
 * live2d-mcp test — 交互式手动验证 REPL
 *
 * 用法: npx tsx src/cli.ts test
 *
 * 命令:
 *   expression <name>      切换表情
 *   motion <group> [index] 播放动作 (默认 index=0)
 *   animate <name>         播放语义动画
 *   parameter <id> <value> 操控单个参数
 *   params <json-array>    批量操控参数 (JSON)
 *   status                 查看模型信息
 *   list                   列出可用表情/动作/动画
 *   help                   显示帮助
 *   quit                   退出
 */

import * as readline from 'node:readline'
import { readConfig } from './config.js'
import { readModelManifest } from './model-reader.js'
import { resolveExpression } from './expressions.js'
import { buildAnimations } from './animations.js'
import { dispatchTool } from './tools.js'
import { startOrConnectWS } from './ws-hub.js'


const HELP = `
命令:
  expression <name>      切换表情    例: expression aixinyan
  motion <group> [idx]   播放动作    例: motion Idle 0
  animate <name>         语义动画    例: animate wink
  parameter <id> <val>   操控参数    例: parameter ParamAngleX -10
  params <json>          批量参数    例: params [{"id":"ParamEyeLOpen","value":0}]
  status                 模型信息
  list                   列出可用项
  help                   帮助
  quit / exit            退出
`

export async function runTestRepl(): Promise<void> {
  console.log('Live2D MCP — 交互式测试 REPL\n')

  // 读配置 + 模型
  let config, manifest
  try {
    config = readConfig()
    manifest = readModelManifest(config.model.path)
  } catch (e) {
    console.error('启动失败:', (e as Error).message)
    process.exit(1)
  }

  // 连接 WS hub（自动 server/client）
  const wsHub = await startOrConnectWS(config.ws.port, config.ws.host)

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.setPrompt('live2d> ')
  rl.prompt()

  console.log(`模型: ${manifest.name}`)
  console.log(`WS: ws://${config.ws.host}:${config.ws.port}`)
  console.log(`输入 help 查看命令, quit 退出\n`)

  rl.on('line', (line: string) => {
    const input = line.trim()
    if (!input) { rl.prompt(); return }

    const parts = input.split(/\s+/)
    const cmd = parts[0].toLowerCase()

    try {
      switch (cmd) {
        case 'quit':
        case 'exit':
          console.log('bye')
          wsHub.close()
          rl.close()
          process.exit(0)

        case 'help':
          console.log(HELP)
          break

        case 'list':
        case 'status': {
          const result = dispatchTool('live2d_status', {}, manifest)
          console.log(result.content[0].text)
          break
        }

        case 'expression':
        case 'expr': {
          if (!parts[1]) { console.log('用法: expression <name>'); break }
          const result = dispatchTool('live2d_expression', { name: parts[1] }, manifest, wsHub)
          console.log('  →', result.content[0].text)
          // 显示表情参数
          const params = resolveExpression(manifest, parts[1])
          if (params && params.length > 0) {
            console.log('  参数:', params.map(p => `${p.id}=${p.value}`).join(', '))
          }
          break
        }

        case 'motion': {
          if (!parts[1]) { console.log('用法: motion <group> [index]'); break }
          const idx = parseInt(parts[2] ?? '0', 10)
          const result = dispatchTool('live2d_motion', { group: parts[1], index: idx }, manifest, wsHub)
          console.log('  →', result.content[0].text)
          break
        }

        case 'animate':
        case 'anim': {
          if (!parts[1]) { console.log('用法: animate <name>'); break }
          const result = dispatchTool('live2d_animate', { name: parts[1] }, manifest, wsHub)
          console.log('  →', result.content[0].text)
          // 显示动画参数
          const anims = buildAnimations(manifest)
          const anim = anims.find(a => a.name === parts[1])
          if (anim) {
            console.log('  参数序列:', anim.params.map(p => `${p.id}=${p.value}@${p.duration ?? 0}ms`).join(' → '))
          }
          break
        }

        case 'parameter':
        case 'param': {
          if (!parts[1] || parts[2] === undefined) {
            console.log('用法: parameter <id> <value>')
            break
          }
          const result = dispatchTool('live2d_parameter', {
            params: [{ id: parts[1], value: parseFloat(parts[2]) }]
          }, manifest, wsHub)
          console.log('  →', result.content[0].text)
          break
        }

        case 'params': {
          // 批量参数: params [{"id":"...","value":...},...]
          const jsonStr = input.slice(cmd.length).trim()
          if (!jsonStr) { console.log('用法: params \'[{"id":"ParamEyeLOpen","value":0}]\''); break }
          const arr = JSON.parse(jsonStr) as Array<{ id: string; value: number }>
          const result = dispatchTool('live2d_parameter', { params: arr }, manifest, wsHub)
          console.log('  →', result.content[0].text)
          break
        }

        default:
          console.log(`未知命令: ${cmd}。输入 help 查看帮助`)
      }
    } catch (e) {
      console.error('  错误:', (e as Error).message)
    }

    rl.prompt()
  })

  rl.on('close', () => {
    wsHub.close()
    process.exit(0)
  })
}

// 直接运行时启动 REPL
if (process.argv[1]?.includes('test-repl')) {
  runTestRepl().catch((err) => {
    console.error('[test] 启动失败:', (err as Error).message)
    process.exit(1)
  })
}
