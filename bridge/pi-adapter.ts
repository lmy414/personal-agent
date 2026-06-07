/**
 * pi-adapter — Pi 事件 → 协议消息 纯翻译器
 *
 * 职责：将 Pi Agent 事件流（agent_start、message_update、tool_execution_end 等）
 * 翻译为统一的 ServerMessage 协议消息，通过 broadcast 回调发出。
 *
 * 不负责：DB 持久化、自动压缩、自动命名、业务逻辑 — 这些留给 handler。
 *
 * 用法：
 *   const unsub = createPiAdapter(session, sessionId, (msg) => ws.send(JSON.stringify(msg)))
 *   try { await session.prompt(content) } finally { unsub() }
 */

import type { ServerMessage } from './protocol'
import type { CreateAgentSessionResult } from '@pi/coding-agent'

type AgentSessionType = CreateAgentSessionResult['session']

// ── 工具函数 ────────────────────────────────────────────────

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
  }
  return JSON.stringify(content)
}

let seq = 0
function srvId(): string {
  return `srv-${Date.now()}-${++seq}`
}

// ── 翻译器 ──────────────────────────────────────────────────

export function createPiAdapter(
  session: AgentSessionType,
  sessionId: string,
  broadcast: (msg: ServerMessage) => void,
): () => void {
  const toolStartTimes = new Map<string, number>()
  let messageId = ''
  let lastUsage: { input: number; output: number; total: number; cost: number } | undefined

  return session.subscribe((event: any) => {
    switch (event.type) {
      // ── Agent 生命周期 ──

      case 'agent_start':
        broadcast({ type: 'agent.start', id: srvId(), sessionId, ts: Date.now(), payload: {} })
        break

      // ── Turn 生命周期 ──

      case 'turn_start':
        broadcast({
          type: 'turn.start', id: srvId(), sessionId, ts: Date.now(),
          payload: { turnIndex: Date.now() },
        })
        break

      // ── 消息流 ──

      case 'message_start':
        if (event.message?.role === 'assistant') {
          messageId = `msg-${Date.now()}`
          broadcast({
            type: 'message.start', id: srvId(), sessionId, ts: Date.now(),
            payload: { messageId, role: 'assistant' },
          })
        }
        break

      case 'message_update': {
        const ame = event.assistantMessageEvent
        if (!ame) break
        if (ame.type === 'text_delta' || ame.type === 'thinking_delta') {
          broadcast({
            type: 'message.delta', id: srvId(), sessionId, ts: Date.now(),
            payload: {
              messageId,
              delta: ame.delta,
              deltaType: ame.type === 'thinking_delta' ? 'thinking' : 'text',
            },
          })
        }
        break
      }

      case 'message_end': {
        const message = event.message
        if (message?.role === 'assistant') {
          const usage = message.usage
          if (usage) {
            lastUsage = {
              input: usage.input,
              output: usage.output,
              total: usage.totalTokens,
              cost: usage.cost?.total ?? 0,
            }
          }
          broadcast({
            type: 'message.end', id: srvId(), sessionId, ts: Date.now(),
            payload: {
              messageId,
              content: extractTextContent(message.content),
              usage: usage
                ? { input: usage.input, output: usage.output, total: usage.totalTokens }
                : { input: 0, output: 0, total: 0 },
            },
          })
        }
        break
      }

      // ── 工具执行 ──

      case 'tool_execution_start':
        toolStartTimes.set(event.toolCallId, Date.now())
        broadcast({
          type: 'tool.start', id: srvId(), sessionId, ts: Date.now(),
          payload: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.args ?? {},
          },
        })
        break

      case 'tool_execution_update':
        broadcast({
          type: 'tool.progress', id: srvId(), sessionId, ts: Date.now(),
          payload: {
            toolCallId: event.toolCallId,
            output: typeof event.partialResult === 'string'
              ? event.partialResult
              : JSON.stringify(event.partialResult),
          },
        })
        break

      case 'tool_execution_end': {
        const startTime = toolStartTimes.get(event.toolCallId)
        const duration = startTime ? Date.now() - startTime : 0
        toolStartTimes.delete(event.toolCallId)
        broadcast({
          type: 'tool.end', id: srvId(), sessionId, ts: Date.now(),
          payload: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            output: typeof event.result === 'string' ? event.result : JSON.stringify(event.result),
            duration,
            status: event.isError ? 'error' : 'success',
            isError: event.isError ?? false,
          },
        })
        break
      }

      // ── Agent 结束 ──

      case 'agent_end': {
        if (event.error) {
          broadcast({
            type: 'turn.error', id: srvId(), sessionId, ts: Date.now(),
            payload: {
              code: event.error.code ?? 'AGENT_ERROR',
              message: event.error.message ?? 'Agent execution error',
              recoverable: true,
            },
          })
        }
        broadcast({
          type: 'turn.end', id: srvId(), sessionId, ts: Date.now(),
          payload: {
            turnIndex: 0,
            usage: lastUsage
              ? { input: lastUsage.input, output: lastUsage.output, total: lastUsage.total }
              : { input: 0, output: 0, total: 0 },
            cost: lastUsage?.cost ?? 0,
          },
        })
        break
      }

      // ── Pi 内部错误 ──

      case 'error':
        broadcast({
          type: 'turn.error', id: srvId(), sessionId, ts: Date.now(),
          payload: {
            code: event.code ?? 'PI_ERROR',
            message: event.message ?? 'Unknown Pi error',
            recoverable: true,
          },
        })
        break
    }
  })
}
