/**
 * MCP Protocol Test — spawns server, sends JSON-RPC over STDIO, validates responses.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/index.ts')
let reqId = 0

// ── Spawn helper (Windows-compatible) ──────────────

function spawnServer(): ChildProcess {
  return spawn('npx', ['tsx', SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env },
  })
}

// ── Result tracking ─────────────────────────────────

interface TestResult { name: string; pass: boolean; detail?: string }
const results: TestResult[] = []

async function test(name: string, fn: () => Promise<boolean>) {
  try {
    const pass = await fn()
    results.push({ name, pass })
    console.log(`    ${pass ? '✅' : '❌'} ${name}`)
  } catch (e) {
    results.push({ name, pass: false, detail: String(e) })
    console.log(`    ❌ ${name}: ${e}`)
  }
}

// ── Session helper ──────────────────────────────────

function makeSession(): {
  child: ChildProcess
  send: (method: string, params?: Record<string, unknown>) => Promise<any>
  kill: () => void
} {
  const child = spawnServer()
  const pending = new Map<number, (msg: any) => void>()
  const rl = createInterface({ input: child.stdout! })

  rl.on('line', (line) => {
    try {
      const msg = JSON.parse(line)
      if (msg.id !== null && msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)!(msg)
        pending.delete(msg.id)
      }
    } catch { /* skip */ }
  })

  function send(method: string, params?: Record<string, unknown>): Promise<any> {
    const id = ++reqId
    return new Promise((resolve, reject) => {
      pending.set(id, resolve)
      child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} }) + '\n')
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout: ${method}`)) }
      }, 5000)
    })
  }

  function kill() { child.kill() }
  return { child, send, kill }
}

// ── Main ────────────────────────────────────────────

async function main() {
  console.log('=== MCP Protocol Test ===\n')

  // Tests 1-5: happy path with a spawned server
  const s1 = makeSession()
  await new Promise(r => setTimeout(r, 800))

  await test('initialize', async () => {
    const res = await s1.send('initialize')
    return res.result?.serverInfo?.name === 'live2d-desktop-pet'
      && res.result?.protocolVersion === '2024-11-05'
  })

  await test('tools/list', async () => {
    const res = await s1.send('tools/list')
    const names: string[] = (res.result?.tools ?? []).map((t: any) => t.name).sort()
    const expected = ['action_list', 'action_perform', 'expression_list', 'expression_set', 'model_load']
    return JSON.stringify(names) === JSON.stringify(expected)
  })

  await test('model_load', async () => {
    const res = await s1.send('tools/call', { name: 'model_load', arguments: { path: '/tmp/test/' } })
    const text = res.result?.content?.[0]?.text ?? ''
    return text.includes('模型已加载') && text.includes('aixinyan')
  })

  await test('expression_list (after load)', async () => {
    const res = await s1.send('tools/call', { name: 'expression_list', arguments: {} })
    const text = res.result?.content?.[0]?.text ?? ''
    return text.includes('可用表情') && text.includes('aixinyan')
  })

  await test('expression_set', async () => {
    const res = await s1.send('tools/call', { name: 'expression_set', arguments: { name: 'aixinyan' } })
    const text = res.result?.content?.[0]?.text ?? ''
    return text.includes('表情已设置')
  })

  s1.kill()

  // Test 6: expression_set before model_load → should fail
  const s2 = makeSession()
  await new Promise(r => setTimeout(r, 500))

  await test('expression_set (no model)', async () => {
    const res = await s2.send('tools/call', { name: 'expression_set', arguments: { name: 'test' } })
    const text = res.result?.content?.[0]?.text ?? ''
    return text.includes('请先 model_load')
  })

  s2.kill()

  // Test 7: unknown tool → error
  const s3 = makeSession()
  await new Promise(r => setTimeout(r, 500))

  await test('unknown tool', async () => {
    const res = await s3.send('tools/call', { name: 'unknown_tool', arguments: {} })
    return res.error?.code === -32601
  })

  s3.kill()

  // Test 8: ping
  const s4 = makeSession()
  await new Promise(r => setTimeout(r, 500))

  await test('ping', async () => {
    const res = await s4.send('ping')
    return res.result !== undefined && res.error === undefined
  })

  s4.kill()

  // ── Summary ──────────────────────────────────────
  const passed = results.filter(r => r.pass).length
  console.log(`\n=== ${passed}/${results.length} passed ===`)
  for (const r of results) {
    if (!r.pass) console.log(`  ❌ ${r.name}${r.detail ? ': ' + r.detail : ''}`)
  }
  process.exit(passed === results.length ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
