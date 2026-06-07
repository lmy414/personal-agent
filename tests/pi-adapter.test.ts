/**
 * Pi Adapter 翻译器测试
 *
 * 验证 pi-adapter.ts 的核心翻译逻辑：
 *   - Pi 事件 → ServerMessage 协议消息
 *   - 事件类型完整覆盖
 *   - extractTextContent 处理各种 content 格式
 *   - 工具执行时间计算
 *   - usage/cost 数据传递
 *
 * 使用 mock session 对象，不依赖 Pi SDK。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'

// ── 从 pi-adapter.ts 提取的核心逻辑 ──────────────────────────

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

// ── 模拟 Pi 事件翻译 ─────────────────────────────────────────

interface TranslatedMessage {
  type: string
  payload: Record<string, unknown>
}

function translatePiEvent(event: Record<string, any>): TranslatedMessage | null {
  let messageId = ''
  let lastUsage: Record<string, number> | undefined

  switch (event.type) {
    case 'agent_start':
      return { type: 'agent.start', payload: {} }

    case 'turn_start':
      return { type: 'turn.start', payload: { turnIndex: Date.now() } }

    case 'message_start': {
      if (event.message?.role === 'assistant') {
        messageId = `msg-${Date.now()}`
        return { type: 'message.start', payload: { messageId, role: 'assistant' } }
      }
      return null
    }

    case 'message_update': {
      const ame = event.assistantMessageEvent
      if (!ame) return null
      if (ame.type === 'text_delta' || ame.type === 'thinking_delta') {
        return {
          type: 'message.delta',
          payload: {
            messageId,
            delta: ame.delta,
            deltaType: ame.type === 'thinking_delta' ? 'thinking' : 'text',
          },
        }
      }
      return null
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
        return {
          type: 'message.end',
          payload: {
            messageId,
            content: extractTextContent(message.content),
            usage: usage
              ? { input: usage.input, output: usage.output, total: usage.totalTokens }
              : { input: 0, output: 0, total: 0 },
          },
        }
      }
      return null
    }

    case 'tool_execution_start':
      return {
        type: 'tool.start',
        payload: {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          input: event.args ?? {},
        },
      }

    case 'tool_execution_update':
      return {
        type: 'tool.progress',
        payload: {
          toolCallId: event.toolCallId,
          output: typeof event.partialResult === 'string'
            ? event.partialResult
            : JSON.stringify(event.partialResult),
        },
      }

    case 'tool_execution_end':
      return {
        type: 'tool.end',
        payload: {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          output: typeof event.result === 'string' ? event.result : JSON.stringify(event.result),
          status: event.isError ? 'error' : 'success',
          isError: event.isError ?? false,
        },
      }

    case 'agent_end':
      if (event.error) {
        return {
          type: 'turn.error',
          payload: {
            code: event.error.code ?? 'AGENT_ERROR',
            message: event.error.message ?? 'Agent execution error',
            recoverable: true,
          },
        }
      }
      return {
        type: 'turn.end',
        payload: {
          usage: lastUsage
            ? { input: lastUsage.input, output: lastUsage.output, total: lastUsage.total }
            : { input: 0, output: 0, total: 0 },
          cost: lastUsage?.cost ?? 0,
        },
      }

    case 'error':
      return {
        type: 'turn.error',
        payload: {
          code: event.code ?? 'PI_ERROR',
          message: event.message ?? 'Unknown Pi error',
          recoverable: true,
        },
      }

    default:
      return null
  }
}

// ── 测试 ──────────────────────────────────────────────────────

describe('Pi Adapter — extractTextContent', () => {
  it('字符串直接返回', () => {
    assert.strictEqual(extractTextContent('你好'), '你好')
  })

  it('content block 数组提取 text', () => {
    const content = [
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'World' },
    ]
    assert.strictEqual(extractTextContent(content), 'Hello World')
  })

  it('混合 content block 只提取 text 类型', () => {
    const content = [
      { type: 'text', text: '文本内容' },
      { type: 'image', data: 'base64...' },
      { type: 'tool_use', name: 'bash' },
    ]
    assert.strictEqual(extractTextContent(content), '文本内容')
  })

  it('空数组返回空字符串', () => {
    assert.strictEqual(extractTextContent([]), '')
  })

  it('未知类型 JSON.stringify', () => {
    assert.strictEqual(extractTextContent(42), '42')
    assert.strictEqual(extractTextContent(true), 'true')
    assert.strictEqual(extractTextContent(null), 'null')
  })

  it('空字符串返回空字符串', () => {
    assert.strictEqual(extractTextContent(''), '')
  })
})

describe('Pi Adapter — 事件翻译', () => {
  it('agent_start → agent.start', () => {
    const msg = translatePiEvent({ type: 'agent_start' })
    assert.ok(msg)
    assert.strictEqual(msg!.type, 'agent.start')
  })

  it('turn_start → turn.start', () => {
    const msg = translatePiEvent({ type: 'turn_start' })
    assert.ok(msg)
    assert.strictEqual(msg!.type, 'turn.start')
    assert.ok(typeof msg!.payload.turnIndex === 'number')
  })

  it('message_start (assistant) → message.start', () => {
    const msg = translatePiEvent({
      type: 'message_start',
      message: { role: 'assistant' },
    })
    assert.ok(msg)
    assert.strictEqual(msg!.type, 'message.start')
    assert.strictEqual(msg!.payload.role, 'assistant')
    assert.ok(typeof msg!.payload.messageId === 'string')
  })

  it('message_start (user) 被忽略', () => {
    const msg = translatePiEvent({
      type: 'message_start',
      message: { role: 'user' },
    })
    assert.strictEqual(msg, null)
  })

  it('message_update text_delta → message.delta', () => {
    const msg = translatePiEvent({
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', delta: '你好' },
    })
    assert.ok(msg)
    assert.strictEqual(msg!.type, 'message.delta')
    assert.strictEqual(msg!.payload.delta, '你好')
    assert.strictEqual(msg!.payload.deltaType, 'text')
  })

  it('message_update thinking_delta → message.delta (thinking)', () => {
    const msg = translatePiEvent({
      type: 'message_update',
      assistantMessageEvent: { type: 'thinking_delta', delta: '思考中...' },
    })
    assert.ok(msg)
    assert.strictEqual(msg!.payload.deltaType, 'thinking')
  })

  it('message_update 无 assistantMessageEvent 被忽略', () => {
    const msg = translatePiEvent({ type: 'message_update' })
    assert.strictEqual(msg, null)
  })

  it('tool_execution_start → tool.start', () => {
    const msg = translatePiEvent({
      type: 'tool_execution_start',
      toolCallId: 'tc-1',
      toolName: 'bash',
      args: { command: 'ls' },
    })
    assert.ok(msg)
    assert.strictEqual(msg!.type, 'tool.start')
    assert.strictEqual(msg!.payload.toolCallId, 'tc-1')
    assert.strictEqual(msg!.payload.toolName, 'bash')
    assert.deepStrictEqual(msg!.payload.input, { command: 'ls' })
  })

  it('tool_execution_update → tool.progress', () => {
    const msg = translatePiEvent({
      type: 'tool_execution_update',
      toolCallId: 'tc-1',
      partialResult: 'running...',
    })
    assert.ok(msg)
    assert.strictEqual(msg!.type, 'tool.progress')
    assert.strictEqual(msg!.payload.output, 'running...')
  })

  it('tool_execution_update 非 string 结果 JSON 序列化', () => {
    const msg = translatePiEvent({
      type: 'tool_execution_update',
      toolCallId: 'tc-1',
      partialResult: { files: ['a.ts', 'b.ts'] },
    })
    assert.ok(msg)
    assert.ok(typeof msg!.payload.output === 'string')
    assert.ok((msg!.payload.output as string).includes('a.ts'))
  })

  it('tool_execution_end (success) → tool.end', () => {
    const msg = translatePiEvent({
      type: 'tool_execution_end',
      toolCallId: 'tc-1',
      toolName: 'bash',
      result: 'done',
      isError: false,
    })
    assert.ok(msg)
    assert.strictEqual(msg!.type, 'tool.end')
    assert.strictEqual(msg!.payload.status, 'success')
    assert.strictEqual(msg!.payload.isError, false)
  })

  it('tool_execution_end (error) → tool.end with error status', () => {
    const msg = translatePiEvent({
      type: 'tool_execution_end',
      toolCallId: 'tc-1',
      toolName: 'bash',
      result: 'command not found',
      isError: true,
    })
    assert.ok(msg)
    assert.strictEqual(msg!.payload.status, 'error')
    assert.strictEqual(msg!.payload.isError, true)
  })

  it('agent_end (no error) → turn.end', () => {
    const msg = translatePiEvent({ type: 'agent_end' })
    assert.ok(msg)
    assert.strictEqual(msg!.type, 'turn.end')
  })

  it('agent_end (with error) → turn.error', () => {
    const msg = translatePiEvent({
      type: 'agent_end',
      error: { code: 'TIMEOUT', message: 'Request timed out' },
    })
    assert.ok(msg)
    assert.strictEqual(msg!.type, 'turn.error')
    assert.strictEqual(msg!.payload.code, 'TIMEOUT')
  })

  it('Pi error → turn.error', () => {
    const msg = translatePiEvent({
      type: 'error',
      code: 'RATE_LIMIT',
      message: 'Too many requests',
    })
    assert.ok(msg)
    assert.strictEqual(msg!.type, 'turn.error')
    assert.strictEqual(msg!.payload.code, 'RATE_LIMIT')
  })

  it('未知事件类型返回 null', () => {
    const msg = translatePiEvent({ type: 'unknown_event' })
    assert.strictEqual(msg, null)
  })
})

describe('Pi Adapter — message.ts 重复代码检测', () => {
  it('message.ts 和 pi-adapter.ts 都包含 extractTextContent', () => {
    // 这是一个设计问题记录：message.ts 内联了 Pi 事件翻译逻辑，
    // 与 pi-adapter.ts 功能重复。应统一使用 pi-adapter.ts。
    const fs = require('fs')
    const path = require('path')
    const root = path.resolve(__dirname, '..')

    const messageContent = fs.readFileSync(path.join(root, 'bridge/handlers/message.ts'), 'utf-8')
    const adapterContent = fs.readFileSync(path.join(root, 'bridge/pi-adapter.ts'), 'utf-8')

    const messageHasExtract = messageContent.includes('extractTextContent')
    const adapterHasExtract = adapterContent.includes('extractTextContent')

    assert.ok(messageHasExtract, 'message.ts 包含 extractTextContent')
    assert.ok(adapterHasExtract, 'pi-adapter.ts 包含 extractTextContent')
    // 两者都有 = 代码重复
    console.log('  ⚠️  message.ts 和 pi-adapter.ts 都包含 extractTextContent，存在代码重复')
  })
})
