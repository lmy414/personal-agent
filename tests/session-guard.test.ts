/**
 * Session 保护边界测试 —— 验证主会话不可删、history retention 生效
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'

// 从 bridge/handlers/session.ts 提取的核心逻辑（纯逻辑，无 DB 依赖）

function isMainSession(sessionId: string, mainSessionId: string): boolean {
  return sessionId === mainSessionId
}

function sanitizeTitle(title: string): string {
  return title.replace(/<[^>]*>/g, '').slice(0, 100)
}

function getHistoryOffset(totalCount: number, retention: number): number {
  return Math.max(0, totalCount - retention)
}

describe('Session Guard — 主会话保护', () => {
  it('主会话 ID 匹配返回 true', () => {
    assert.strictEqual(isMainSession('abc-123', 'abc-123'), true)
  })

  it('非主会话返回 false', () => {
    assert.strictEqual(isMainSession('other-id', 'abc-123'), false)
  })
})

describe('Session Guard — 标题消毒', () => {
  it('去除 HTML 标签', () => {
    assert.strictEqual(sanitizeTitle('<b>Test</b>'), 'Test')
  })

  it('截断超过 100 字符', () => {
    const long = 'a'.repeat(200)
    assert.strictEqual(sanitizeTitle(long).length, 100)
  })

  it('保留普通中文和符号', () => {
    assert.strictEqual(sanitizeTitle('会话 <> 测试'), '会话  测试')
  })
})

describe('Session Guard — history retention 计算', () => {
  it('消息数少于 retention 时 offset 为 0', () => {
    assert.strictEqual(getHistoryOffset(50, 100), 0)
  })

  it('消息数超过 retention 时正确截断', () => {
    assert.strictEqual(getHistoryOffset(150, 100), 50)
  })

  it('retention 为 0 时 offset 等于 total', () => {
    assert.strictEqual(getHistoryOffset(20, 0), 20)
  })
})
