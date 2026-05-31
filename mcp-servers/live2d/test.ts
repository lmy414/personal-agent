/**
 * 最简原型测试 — 直接调用 MCP Server handler，不启动子进程
 *
 * 用法: npx tsx test.ts
 *
 * 模拟 mcporter 调 MCP Server 的完整流程：
 *   1. initialize      → 能力协商
 *   2. notifications/initialized
 *   3. tools/list      → 发现工具
 *   4. tools/call      → 调 live2d_expression
 *   5. tools/call      → 调 live2d_motion
 *   6. tools/call      → 调 live2d_status
 *   7. ping            → 心跳
 */

import { ok, rpcErr, TOOLS, EXPRESSIONS, MOTIONS } from './index.js'

// ══════════ mock Bridge（返回模拟数据） ══════════
// 模拟 sendToBrowser 的返回
function mockSendToBrowser(tool: string, args: Record<string, string>): string {
  if (tool === 'live2d_expression') return `表情已切换: ${EXPRESSIONS[args.name] ?? args.name}`
  if (tool === 'live2d_motion') return `动作已播放: ${MOTIONS[args.name] ?? args.name}`
  return 'ok'
}

// ══════════ 模拟 MCP Server handler ══════════
import { handleRequest } from './index.js'

async function call(method: string, params?: Record<string, unknown>) {
  const req = { jsonrpc: '2.0' as const, id: ++testId, method, params }
  console.log('\n→', JSON.stringify(req))
  const response = await handleRequest(req, mockSendToBrowser)
  if (response) {
    console.log('←', JSON.stringify(JSON.parse(response), null, 2).slice(0, 400))
  } else {
    console.log('← (no response — notification)')
  }
}

let testId = 0

async function main() {
  console.log('=== MCP Server 原型测试 ===\n')

  // ① 握手
  await call('initialize', {
    protocolVersion: '2024-11-05',
    clientInfo: { name: 'test-client' },
  })

  // ② 确认初始化
  await call('notifications/initialized')

  // ③ 发现工具
  await call('tools/list')

  // ④ 调表情
  await call('tools/call', {
    name: 'live2d_expression',
    arguments: { name: 'lianhong' },
  })

  // ⑤ 无效表情
  await call('tools/call', {
    name: 'live2d_expression',
    arguments: { name: 'nonexistent' },
  })

  // ⑥ 调动作
  await call('tools/call', {
    name: 'live2d_motion',
    arguments: { name: 'Scene1' },
  })

  // ⑦ 查状态
  await call('tools/call', {
    name: 'live2d_status',
    arguments: {},
  })

  // ⑧ 心跳
  await call('ping')

  console.log('\n=== 测试完成 ===')
}

main()
