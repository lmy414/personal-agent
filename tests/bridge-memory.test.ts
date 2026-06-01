/**
 * Bridge Memory Handler 测试 —— 验证 getAllMemories / searchMemories 逻辑
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// We test the logic inline since bridge handler imports use absolute paths
// that only resolve correctly on Mirror's machine

function splitEntries(text: string): string[] {
  return text
    .split('§')
    .map(e => e.trim())
    .filter(e => e.length > 0)
}

function readFileAsText(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return ''
    return fs.readFileSync(filePath, 'utf-8').trim()
  } catch {
    return ''
  }
}

export interface MemoryEntry {
  content: string
  source: 'memory' | 'user'
}

function getAllMemories(memDir: string): MemoryEntry[] {
  const memText = readFileAsText(path.join(memDir, 'MEMORY.md'))
  const userText = readFileAsText(path.join(memDir, 'USER.md'))

  return [
    ...splitEntries(memText).map(e => ({ content: e, source: 'memory' as const })),
    ...splitEntries(userText).map(e => ({ content: e, source: 'user' as const })),
  ]
}

function searchMemories(memDir: string, query: string): MemoryEntry[] {
  const all = getAllMemories(memDir)
  const q = query.toLowerCase()
  return all.filter(e => e.content.toLowerCase().includes(q))
}

// ── 测试 ──────────────────────────────────────────────────

describe('Bridge Memory — getAllMemories', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mio-bmem-test-'))
  })

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('空目录返回空数组', () => {
    const all = getAllMemories(tmpDir)
    assert.deepStrictEqual(all, [])
  })

  it('正确解析 MEMORY.md 和 USER.md', () => {
    fs.writeFileSync(path.join(tmpDir, 'MEMORY.md'), '§ 记忆一\n§ 记忆二\n')
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), '§ 用户画像一\n')

    const all = getAllMemories(tmpDir)
    assert.strictEqual(all.length, 3)
    assert.strictEqual(all[0].source, 'memory')
    assert.strictEqual(all[2].source, 'user')
  })

  it('无 § 的行被忽略', () => {
    fs.writeFileSync(path.join(tmpDir, 'MEMORY.md'), '# 标题\n普通文本\n§ 有效条目\n')
    const all = getAllMemories(tmpDir)
    assert.strictEqual(all.length, 1, '应只有 1 条 § 条目')
  })
})

describe('Bridge Memory — searchMemories', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mio-bmem-test-'))
    fs.writeFileSync(path.join(tmpDir, 'MEMORY.md'), '§ Mirror 偏好 TypeScript 严格模式\n§ 项目使用 SolidJS\n')
    fs.writeFileSync(path.join(tmpDir, 'USER.md'), '§ Mirror 做游戏开发\n§ Mirror 喜欢 VOCALOID\n')
  })

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('搜索 TypeScript 返回 1 条', () => {
    const results = searchMemories(tmpDir, 'TypeScript')
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].source, 'memory')
  })

  it('搜索 Mirror 返回所有包含的条目', () => {
    const results = searchMemories(tmpDir, 'Mirror')
    assert.strictEqual(results.length, 2)
  })

  it('搜索不区分大小写', () => {
    const results = searchMemories(tmpDir, 'typescript')
    assert.strictEqual(results.length, 1)
  })

  it('搜索不存在的词返回空', () => {
    const results = searchMemories(tmpDir, 'zzz不存在')
    assert.strictEqual(results.length, 0)
  })
})

describe('Bridge Memory — splitEntries 边界', () => {
  it('空文本返回空数组', () => {
    assert.deepStrictEqual(splitEntries(''), [])
  })

  it('只有 § 符号返回空数组', () => {
    assert.deepStrictEqual(splitEntries('§'), [])
  })

  it('§ 后空格被 trim', () => {
    const result = splitEntries('§   前面有空格    ')
    assert.strictEqual(result[0], '前面有空格')
  })

  it('多行混合', () => {
    const text = [
      '§ 第一条',
      '',
      '§ 第二条',
      '中间插入的普通行',
      '§ 第三条',
    ].join('\n')
    const result = splitEntries(text)
    assert.strictEqual(result.length, 3)
  })
})
