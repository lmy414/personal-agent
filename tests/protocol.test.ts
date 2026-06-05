/**
 * Protocol 协议测试 —— 验证消息信封创建、解析、类型完整性
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'

// Import protocol from bridge source
import { createEnvelope, parseMessage, type ServerMessage, type ClientMessage } from '../bridge/protocol.js'

const SID = 'test-session-001'

describe('Protocol — createEnvelope', () => {
  it('创建消息信封时自动填充 id / sessionId / ts', () => {
    const env = createEnvelope('message.send', SID, { content: '你好' })
    assert.strictEqual(env.type, 'message.send')
    assert.strictEqual(env.sessionId, SID)
    assert.ok(typeof env.id === 'string' && env.id.length > 0, 'id 应为非空字符串')
    assert.ok(typeof env.ts === 'number' && env.ts > 0, 'ts 应为正数时间戳')
    assert.deepStrictEqual(env.payload, { content: '你好' })
  })

  it('不同消息类型 payload 类型正确', () => {
    const cases: [string, unknown][] = [
      ['session.create', { model: 'deepseek-chat', thinkingLevel: 'medium' }],
      ['message.send', { content: '帮我查个东西', attachments: [] }],
      ['file.list', { path: '/src' }],
      ['settings.get', {}],
      ['session.history', { sessionId: 'abc123' }],
    ]
    for (const [type, payload] of cases) {
      const env = createEnvelope(type as any, SID, payload)
      assert.strictEqual(env.type, type)
      assert.deepStrictEqual(env.payload, payload)
    }
  })

  it('每次调用生成不同的 id', () => {
    const a = createEnvelope('message.send', SID, { content: 'a' })
    const b = createEnvelope('message.send', SID, { content: 'b' })
    assert.notStrictEqual(a.id, b.id)
  })
})

describe('Protocol — parseMessage', () => {
  it('解析合法 JSON 信封', () => {
    const env = createEnvelope('message.send', SID, { content: '测试' })
    const raw = JSON.stringify(env)
    const parsed = parseMessage(raw)
    assert.strictEqual(parsed.type, env.type)
    assert.strictEqual(parsed.id, env.id)
    assert.strictEqual(parsed.sessionId, env.sessionId)
  })

  it('解析 status.update 信封', () => {
    const env = createEnvelope('status.update', SID, {
      tokens: 1500, cost: 0.003, contextUsed: 60, contextMax: 128, roundCount: 3,
    })
    const parsed = parseMessage(JSON.stringify(env))
    assert.strictEqual(parsed.type, 'status.update')
    const p = parsed.payload as any
    assert.strictEqual(p.tokens, 1500)
    assert.strictEqual(p.cost, 0.003)
  })

  it('parseMessage 对非法 JSON 抛出异常', () => {
    assert.throws(() => parseMessage('not json'), SyntaxError)
  })
})

describe('Protocol — ServerMessage 类型覆盖', () => {
  it('所有 ServerMessage 类型均可 createEnvelope', () => {
    const types: [string, unknown][] = [
      ['session.created', { sessionId: 's1', model: 'd', thinkingLevel: 'low', createdAt: 1 }],
      ['session.list', { sessions: [{ id: 's1', title: 't', lastActive: 1, roundCount: 1 }] }],
      ['session.state', { model: 'm', thinkingLevel: 'l', contextUsed: 10, contextMax: 128, roundCount: 1 }],
      ['turn.start', { turnIndex: 0 }],
      ['message.start', { messageId: 'm1', role: 'assistant' }],
      ['message.delta', { messageId: 'm1', delta: '你好' }],
      ['message.end', { messageId: 'm1', content: '你好', usage: { input: 10, output: 5, total: 15 } }],
      ['turn.end', { turnIndex: 0, usage: { input: 10, output: 5, total: 15 }, cost: 0.001 }],
      ['tool.start', { toolCallId: 't1', toolName: 'bash', input: {} }],
      ['tool.progress', { toolCallId: 't1', output: 'running...' }],
      ['tool.end', { toolCallId: 't1', toolName: 'bash', output: 'done', duration: 100, status: 'success' }],
      ['status.update', { tokens: 0, cost: 0, contextUsed: 0, contextMax: 128, roundCount: 0 }],
      ['file.list', { path: '.', entries: [{ name: 'f.ts', type: 'file', size: 100 }] }],
      ['file.content', { path: 'f.ts', content: 'hello' }],
      ['memory.results', { query: 'q', entries: [{ content: 'c', category: 'memory', importance: 1 }] }],
      ['memory.list', { entries: [{ content: 'c', category: 'memory', importance: 1 }], total: 1 }],
      ['session.history', { sessionId: 's1', messages: [], toolCalls: [] }],
      ['session.renamed', { sessionId: 's1', title: '新标题' }],
      ['session.deleted', { sessionId: 's1' }],
      ['compaction', { beforeTokens: 1000, afterTokens: 500 }],
      ['session.compacted', { tokensBefore: 1000, tokensAfter: 500, tokensSaved: 500, contextWindow: 128 }],
      ['file.changed', { path: 'f.ts' }],
      ['settings.state', { entries: [{ key: 'k', value: 'v' }] }],
      ['error', { code: 'E1', message: 'msg', recoverable: true }],
    ]
    for (const [type, payload] of types) {
      const env = createEnvelope(type as any, SID, payload)
      assert.strictEqual(env.type, type)
    }
  })

  it('所有 ClientMessage 类型均可 createEnvelope', () => {
    const types: [string, unknown][] = [
      ['session.create', { model: 'deepseek-chat' }],
      ['session.list', {}],
      ['session.switch', { sessionId: 's1' }],
      ['session.delete', { sessionId: 's1' }],
      ['session.history', { sessionId: 's1' }],
      ['session.rename', { sessionId: 's1', title: '新标题' }],
      ['session.state', {}],
      ['session.compact', {}],
      ['message.send', { content: '你好' }],
      ['message.cancel', {}],
      ['model.switch', { modelId: 'deepseek-chat' }],
      ['model.list', {}],
      ['file.list', { path: '.' }],
      ['file.read', { path: 'f.ts' }],
      ['memory.search', { query: '测试' }],
      ['memory.list', { limit: 10 }],
      ['settings.get', {}],
      ['settings.set', { key: 'k', value: 'v' }],
      ['settings.discover-models', {}],
    ]
    for (const [type, payload] of types) {
      const env = createEnvelope(type as any, SID, payload)
      assert.strictEqual(env.type, type)
    }
  })
})
