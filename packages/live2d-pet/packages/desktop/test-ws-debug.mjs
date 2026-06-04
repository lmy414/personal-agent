/**
 * Standalone WS debug test — sends messages to desktop WS server and logs responses.
 *
 * Usage: node packages/desktop/test-ws-debug.mjs
 *
 * Run this AFTER starting the desktop app (npx electron . in packages/desktop)
 */

import { WebSocket } from 'ws'

const URL = 'ws://localhost:9228'
const TIMEOUT = 5000

function sendAndWait(ws, msg, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to ${label}`))
    }, TIMEOUT)

    const handler = (raw) => {
      const str = raw.toString()
      try {
        const resp = JSON.parse(str)
        if (resp._rid === msg._rid) {
          clearTimeout(timer)
          ws.removeListener('message', handler)
          resolve(resp)
        } else {
          console.log(`  [${label}] received unrelated msg:`, resp.type, resp._rid)
        }
      } catch {
        console.log(`  [${label}] received non-JSON:`, str.slice(0, 100))
      }
    }

    ws.on('message', handler)

    const raw = JSON.stringify(msg)
    console.log(`  [${label}] sending:`, raw.slice(0, 150))
    ws.send(raw)
  })
}

async function main() {
  console.log('=== WS Debug Test ===\n')

  const ws = new WebSocket(URL)

  ws.on('error', (err) => {
    console.error('Connection error:', err.message)
    process.exit(1)
  })

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Connection timeout')), TIMEOUT)
    ws.on('open', () => {
      clearTimeout(timer)
      console.log(`Connected to ${URL}\n`)
      resolve()
    })
  })

  // Test 1: l2d.settings.get (handled directly by main process)
  console.log('--- Test 1: l2d.settings.get ---')
  try {
    const resp = await sendAndWait(ws, {
      type: 'l2d.settings.get',
      _rid: 'test-1',
    }, 'settings.get')
    console.log('  ✅ Response:', JSON.stringify(resp).slice(0, 300))
  } catch (e) {
    console.error('  ❌ Failed:', e.message)
  }

  console.log()

  // Test 2: l2d.model.load (forwarded to renderer via IPC)
  console.log('--- Test 2: l2d.model.load ---')
  try {
    // Note: l2d.model.load is a notification, no response expected
    // But we can check if it's forwarded
    ws.send(JSON.stringify({
      type: 'l2d.model.load',
      payload: { path: '/test/path' },
      _rid: 'test-2',
    }))
    console.log('  ✅ Sent (notification, no response expected)')
  } catch (e) {
    console.error('  ❌ Send failed:', e.message)
  }

  console.log()

  // Test 3: l2d.settings.set (handled directly by main process)
  console.log('--- Test 3: l2d.settings.set ---')
  try {
    const resp = await sendAndWait(ws, {
      type: 'l2d.settings.set',
      payload: { 'window.width': 400, 'window.height': 600 },
      _rid: 'test-3',
    }, 'settings.set')
    console.log('  ✅ Response:', JSON.stringify(resp).slice(0, 300))
  } catch (e) {
    console.error('  ❌ Failed:', e.message)
  }

  console.log()
  console.log('=== Tests complete ===')
  ws.close()
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
