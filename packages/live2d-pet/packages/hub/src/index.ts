/**
 * WS Hub — WebSocket Server for Live2D Desktop Pet
 *
 * - Accepts l2d.* messages from MCP adapter (or any WS client)
 * - Routes to handlers, maintains model state
 * - Designed to be embedded in Electron main process (packages/desktop)
 *
 * Usage:
 *   npx tsx src/index.ts                     # standalone dev
 *   import { createHub } from '@live2d-pet/hub'  # embedded in Electron
 */

import { WebSocketServer, WebSocket } from 'ws'
import { handleMessage, createState, type HubState } from './handler'

const PORT = 9228

export function createHub(): { state: HubState; close: () => Promise<void> } {
  const state = createState()
  const wss = new WebSocketServer({ port: PORT })

  wss.on('listening', () => {
    console.log(`[hub] listening on ws://localhost:${PORT}`)
  })

  wss.on('connection', (ws: WebSocket) => {
    console.log('[hub] client connected')

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (!msg._rid) {
          // Notification (no response expected)
          console.log('[hub] notification:', msg.type)
          return
        }
        const response = await handleMessage(msg, state)
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(response))
        }
      } catch (e) {
        console.error('[hub] error:', e)
      }
    })

    ws.on('close', () => console.log('[hub] client disconnected'))
    ws.on('error', (e) => console.error('[hub] ws error:', e.message))
  })

  const close = async () => {
    return new Promise<void>((resolve) => {
      wss.close(() => resolve())
    })
  }

  return { state, close }
}

// Run standalone when executed directly
if (process.argv[1]?.includes('hub')) {
  createHub()
  console.log('[hub] WS Hub started. Waiting for MCP adapter...')
}
