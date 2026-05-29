import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'

export async function handleMessageSend(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const payload = msg.payload as { content: string }
  const turnIndex = Date.now()
  const messageId = `msg-${turnIndex}`

  ws.send(JSON.stringify({
    type: 'turn.start',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { turnIndex },
  }))

  ws.send(JSON.stringify({
    type: 'message.start',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { messageId, role: 'assistant' },
  }))

  // Simulate streaming response
  const response = `收到你的消息：「${payload.content}」\n\n这是桥接服务器的模拟回复。后续将接入 Pi SDK 实现真正的 AI 对话。`
  let pos = 0
  const chunkSize = 3

  const interval = setInterval(() => {
    if (pos >= response.length) {
      clearInterval(interval)

      ws.send(JSON.stringify({
        type: 'message.end',
        id: `srv-${Date.now()}`,
        sessionId: msg.sessionId,
        ts: Date.now(),
        payload: { messageId, content: response, usage: { input: 50, output: response.length, total: 50 + response.length } },
      }))

      ws.send(JSON.stringify({
        type: 'turn.end',
        id: `srv-${Date.now()}`,
        sessionId: msg.sessionId,
        ts: Date.now(),
        payload: { turnIndex, usage: { input: 50, output: response.length, total: 50 + response.length }, cost: 0.001 },
      }))

      ws.send(JSON.stringify({
        type: 'status.update',
        id: `srv-${Date.now()}`,
        sessionId: msg.sessionId,
        ts: Date.now(),
        payload: { tokens: 300 + response.length, cost: 0.004, contextUsed: 1200, contextMax: 128000, roundCount: 3 },
      }))

      return
    }

    const delta = response.slice(pos, pos + chunkSize)
    pos += chunkSize

    ws.send(JSON.stringify({
      type: 'message.delta',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { messageId, delta },
    }))

    // Simulate tool call mid-stream
    if (pos === 30) {
      const toolId = `tool-${Date.now()}`
      ws.send(JSON.stringify({
        type: 'tool.start',
        id: `srv-${Date.now()}`,
        sessionId: msg.sessionId,
        ts: Date.now(),
        payload: { toolCallId: toolId, toolName: 'read', input: { path: 'CLAUDE.md' } },
      }))

      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'tool.end',
          id: `srv-${Date.now()}`,
          sessionId: msg.sessionId,
          ts: Date.now(),
          payload: { toolCallId: toolId, toolName: 'read', output: '# 澪号 Personal Agent\n...', duration: 142, status: 'success' },
        }))
      }, 500)
    }
  }, 50)
}

export function handleMessageCancel(_msg: ClientMessage, ws: WebSocket): void {
  ws.send(JSON.stringify({
    type: 'error',
    id: `srv-${Date.now()}`,
    sessionId: _msg.sessionId,
    ts: Date.now(),
    payload: { code: 'CANCEL_NOT_IMPLEMENTED', message: 'Cancel not yet supported', recoverable: true },
  }))
}
