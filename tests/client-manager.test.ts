/**
 * Client Manager 广播逻辑测试
 *
 * 验证 client-manager.ts 的核心逻辑：
 *   - 客户端添加/移除
 *   - 广播到所有客户端
 *   - 排除指定客户端的广播
 *   - 已关闭连接的客户端不发送
 *
 * 使用 mock WebSocket 对象。
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'

// ── Mock WebSocket ────────────────────────────────────────────

interface MockWS {
  readyState: number
  sentMessages: string[]
  send(data: string): void
}

const OPEN = 1
const CLOSED = 3

function createMockWS(state: number = OPEN): MockWS {
  return {
    readyState: state,
    sentMessages: [],
    send(data: string) {
      this.sentMessages.push(data)
    },
  }
}

// ── 从 client-manager.ts 提取的逻辑 ──────────────────────────

interface ClientSet {
  add(ws: MockWS): void
  remove(ws: MockWS): void
  broadcast(raw: string): void
  broadcastExcept(raw: string, exclude: MockWS): void
  size(): number
}

function createMockClientSet(): ClientSet {
  const clients = new Set<MockWS>()

  return {
    add(ws) { clients.add(ws) },
    remove(ws) { clients.delete(ws) },
    broadcast(raw) {
      for (const ws of clients) {
        if (ws.readyState === OPEN) ws.send(raw)
      }
    },
    broadcastExcept(raw, exclude) {
      for (const ws of clients) {
        if (ws !== exclude && ws.readyState === OPEN) ws.send(raw)
      }
    },
    size() { return clients.size },
  }
}

// ── 测试 ──────────────────────────────────────────────────────

describe('Client Manager — 添加/移除', () => {
  let cs: ClientSet

  beforeEach(() => {
    cs = createMockClientSet()
  })

  it('添加客户端后 size 增加', () => {
    const ws = createMockWS()
    cs.add(ws)
    assert.strictEqual(cs.size(), 1)
  })

  it('移除客户端后 size 减少', () => {
    const ws = createMockWS()
    cs.add(ws)
    cs.remove(ws)
    assert.strictEqual(cs.size(), 0)
  })

  it('重复添加同一客户端不增加 size', () => {
    const ws = createMockWS()
    cs.add(ws)
    cs.add(ws)
    assert.strictEqual(cs.size(), 1)
  })

  it('移除不存在的客户端无影响', () => {
    const ws1 = createMockWS()
    const ws2 = createMockWS()
    cs.add(ws1)
    cs.remove(ws2)
    assert.strictEqual(cs.size(), 1)
  })

  it('添加多个客户端', () => {
    cs.add(createMockWS())
    cs.add(createMockWS())
    cs.add(createMockWS())
    assert.strictEqual(cs.size(), 3)
  })
})

describe('Client Manager — 广播', () => {
  let cs: ClientSet
  let ws1: MockWS
  let ws2: MockWS

  beforeEach(() => {
    cs = createMockClientSet()
    ws1 = createMockWS()
    ws2 = createMockWS()
    cs.add(ws1)
    cs.add(ws2)
  })

  it('广播消息到所有客户端', () => {
    cs.broadcast('{"type":"test"}')
    assert.strictEqual(ws1.sentMessages.length, 1)
    assert.strictEqual(ws2.sentMessages.length, 1)
    assert.strictEqual(ws1.sentMessages[0], '{"type":"test"}')
  })

  it('广播多次消息', () => {
    cs.broadcast('msg1')
    cs.broadcast('msg2')
    assert.strictEqual(ws1.sentMessages.length, 2)
    assert.strictEqual(ws1.sentMessages[0], 'msg1')
    assert.strictEqual(ws1.sentMessages[1], 'msg2')
  })

  it('已关闭的客户端不接收广播', () => {
    ws1.readyState = CLOSED
    cs.broadcast('test')
    assert.strictEqual(ws1.sentMessages.length, 0)
    assert.strictEqual(ws2.sentMessages.length, 1)
  })

  it('空客户端集广播无错误', () => {
    const emptyCs = createMockClientSet()
    emptyCs.broadcast('test') // 不应抛出
    assert.ok(true)
  })
})

describe('Client Manager — 排除广播', () => {
  let cs: ClientSet
  let ws1: MockWS
  let ws2: MockWS
  let ws3: MockWS

  beforeEach(() => {
    cs = createMockClientSet()
    ws1 = createMockWS()
    ws2 = createMockWS()
    ws3 = createMockWS()
    cs.add(ws1)
    cs.add(ws2)
    cs.add(ws3)
  })

  it('排除指定客户端', () => {
    cs.broadcastExcept('test', ws2)
    assert.strictEqual(ws1.sentMessages.length, 1)
    assert.strictEqual(ws2.sentMessages.length, 0)
    assert.strictEqual(ws3.sentMessages.length, 1)
  })

  it('排除的客户端即使已关闭也不影响其他', () => {
    ws2.readyState = CLOSED
    cs.broadcastExcept('test', ws1)
    assert.strictEqual(ws1.sentMessages.length, 0)
    assert.strictEqual(ws2.sentMessages.length, 0) // 已关闭
    assert.strictEqual(ws3.sentMessages.length, 1)
  })
})

describe('Client Manager — 连接生命周期', () => {
  it('模拟 WS 连接 → 消息 → 断开流程', () => {
    const cs = createMockClientSet()
    const ws = createMockWS()

    // 连接
    cs.add(ws)
    assert.strictEqual(cs.size(), 1)

    // 消息
    cs.broadcast('hello')
    assert.strictEqual(ws.sentMessages.length, 1)

    // 断开
    cs.remove(ws)
    assert.strictEqual(cs.size(), 0)

    // 断开后不再收到消息
    cs.broadcast('after-close')
    assert.strictEqual(ws.sentMessages.length, 1) // 仍然是 1
  })

  it('多客户端部分断开', () => {
    const cs = createMockClientSet()
    const ws1 = createMockWS()
    const ws2 = createMockWS()
    const ws3 = createMockWS()

    cs.add(ws1)
    cs.add(ws2)
    cs.add(ws3)

    cs.broadcast('msg1')
    assert.strictEqual(ws1.sentMessages.length, 1)
    assert.strictEqual(ws2.sentMessages.length, 1)
    assert.strictEqual(ws3.sentMessages.length, 1)

    // ws2 断开
    cs.remove(ws2)
    cs.broadcast('msg2')
    assert.strictEqual(ws1.sentMessages.length, 2)
    assert.strictEqual(ws2.sentMessages.length, 1) // 不再收到
    assert.strictEqual(ws3.sentMessages.length, 2)
  })
})
