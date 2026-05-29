import { WebSocketServer, WebSocket } from 'ws'
import { dispatch } from './dispatcher'

const PORT = 9229

const wss = new WebSocketServer({ port: PORT })

console.log(`[bridge] WebSocket server listening on ws://localhost:${PORT}`)

wss.on('connection', (ws: WebSocket) => {
  console.log('[bridge] client connected')

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      dispatch(msg, ws)
    } catch (err) {
      console.error('[bridge] failed to parse message:', err)
      ws.send(JSON.stringify({
        type: 'error',
        id: 'err-parse',
        sessionId: '',
        ts: Date.now(),
        payload: { code: 'PARSE_ERROR', message: 'Invalid JSON', recoverable: true },
      }))
    }
  })

  ws.on('close', () => {
    console.log('[bridge] client disconnected')
  })

  ws.on('error', (err) => {
    console.error('[bridge] ws error:', err)
  })
})
