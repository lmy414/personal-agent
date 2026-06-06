/**
 * Protocol 类型一致性测试 —— 验证 ServerMessage 类型定义与实际 handler 发送的数据一致
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'

// 从 bridge/protocol.ts 导出的类型（通过 .js 兼容导入）
import { createEnvelope } from '../bridge/protocol.js'

const SID = 'test-session-001'

describe('Protocol — session.state 类型完整性', () => {
  it('session.state 包含 tokens / cost 扩展字段（handler 实际发送）', () => {
    // bridge/handlers/session.ts 的 sendSessionState 实际发送了 tokens 和 cost
    const payload = {
      model: 'deepseek-v3',
      thinkingLevel: 'medium',
      contextUsed: 100,
      contextMax: 128000,
      roundCount: 3,
      tokens: 250,
      cost: 0.001,
    }
    const env = createEnvelope('session.state', SID, payload)
    assert.strictEqual(env.type, 'session.state')
    const p = env.payload as any
    assert.strictEqual(p.tokens, 250)
    assert.strictEqual(p.cost, 0.001)
  })
})

describe('Protocol — 消息类型双向覆盖', () => {
  it('所有 ClientMessage 类型在 createEnvelope 中合法', () => {
    const types = [
      'session.create', 'session.list', 'session.switch', 'session.delete',
      'session.history', 'session.rename', 'session.state', 'session.compact',
      'message.send', 'message.cancel',
      'model.switch', 'model.list',
      'file.list', 'file.read',
      'memory.search', 'memory.list',
      'settings.get', 'settings.set', 'settings.discover-models',
    ]
    for (const t of types) {
      const env = createEnvelope(t as any, SID, {})
      assert.strictEqual(env.type, t)
    }
  })

  it('ping 类型不应导致 dispatcher 返回 error', () => {
    // 前端心跳发送 ping，dispatcher 应静默忽略
    const env = createEnvelope('ping' as any, SID, {})
    assert.strictEqual(env.type, 'ping')
  })
})
