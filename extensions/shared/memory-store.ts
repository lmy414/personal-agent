/**
 * memory-store — § 分隔的 Markdown 记忆文件读写
 * 照搬 Hermes Agent 的 MemoryStore 设计：
 *   - MEMORY.md ≤2200 chars, USER.md ≤1375 chars
 *   - 原子写入（tempfile + fsync + rename）
 *   - 安全扫描（prompt injection 检测）
 *   - 冻结快照（会话内写入不更新快照）
 */
import fs from 'fs'
import path from 'path'
import os from 'os'

// ── 常量 ────────────────────────────────────────────────

const CHAR_LIMITS: Record<string, number> = {
  memory: 2200,
  user: 1375,
}

const THREAT_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /ignore\s+(previous|all|above|prior)\s+instructions/i, name: 'prompt_injection' },
  { pattern: /you\s+are\s+now\s+/i, name: 'role_hijack' },
  { pattern: /[​‌‍﻿‪-‮]/g, name: 'invisible_chars' },
]

// ── 工具函数 ──────────────────────────────────────────────

function charCount(s: string): number {
  return [...s].length // 正确计数 Unicode 字符（含中文）
}

function splitEntries(text: string): string[] {
  return text
    .split('§')
    .map(e => e.trim())
    .filter(e => e.length > 0)
}

function joinEntries(entries: string[]): string {
  return entries.map(e => `§ ${e}`).join('\n')
}

export interface MemoryStore {
  memoryEntries: string[]
  userEntries: string[]
  memoryCharLimit: number
  userCharLimit: number
  _memorySnapshot: string
  _userSnapshot: string
}

// ── 工厂函数 ──────────────────────────────────────────────

export function createMemoryStore(
  memDir: string,
  memoryCharLimit = 2200,
  userCharLimit = 1375,
): MemoryStore {
  if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true })

  const memPath = path.join(memDir, 'MEMORY.md')
  const userPath = path.join(memDir, 'USER.md')

  // 读取磁盘文件
  const memoryEntries = readFileAsEntries(memPath)
  const userEntries = readFileAsEntries(userPath)

  // 冻结快照（会话启动时拍）
  const _memorySnapshot = joinEntries(memoryEntries)
  const _userSnapshot = joinEntries(userEntries)

  return {
    memoryEntries,
    userEntries,
    memoryCharLimit,
    userCharLimit,
    _memorySnapshot,
    _userSnapshot,
  }
}

// ── 文件读写 ──────────────────────────────────────────────

function readFileAsEntries(filePath: string): string[] {
  try {
    if (!fs.existsSync(filePath)) return []
    const raw = fs.readFileSync(filePath, 'utf-8').trim()
    if (!raw) return []
    return splitEntries(raw)
  } catch {
    return []
  }
}

function readFileRaw(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return ''
    return fs.readFileSync(filePath, 'utf-8').trim()
  } catch {
    return ''
  }
}

// ── 安全扫描 ──────────────────────────────────────────────

function scanContent(content: string): { ok: boolean; threat?: string } {
  for (const { pattern, name } of THREAT_PATTERNS) {
    if (pattern.test(content)) return { ok: false, threat: name }
  }
  return { ok: true }
}

// ── 原子写入 ──────────────────────────────────────────────

function atomicWrite(filePath: string, content: string): void {
  const dir = path.dirname(filePath)
  const tmpPath = path.join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const fd = fs.openSync(tmpPath, 'w')
  fs.writeFileSync(fd, content, 'utf-8')
  fs.fsyncSync(fd)
  fs.closeSync(fd)
  fs.renameSync(tmpPath, filePath) // 原子操作
}

// ── 检索 ──────────────────────────────────────────────────

export function searchEntries(
  store: MemoryStore,
  query: string,
  target: 'memory' | 'user' | 'both' = 'memory',
  limit = 3,
): string[] {
  const keywords = extractKeywords(query)
  if (!keywords.length) return []

  const candidates: Array<{ entry: string; source: string }> = []

  if (target === 'memory' || target === 'both') {
    for (const e of store.memoryEntries) {
      candidates.push({ entry: e, source: 'memory' })
    }
  }
  if (target === 'user' || target === 'both') {
    for (const e of store.userEntries) {
      candidates.push({ entry: e, source: 'user' })
    }
  }

  return candidates
    .filter(c => keywords.some(kw => c.entry.includes(kw)))
    .sort((a, b) => {
      // 匹配更多关键词的排前面
      const aHits = keywords.filter(kw => a.entry.includes(kw)).length
      const bHits = keywords.filter(kw => b.entry.includes(kw)).length
      return bHits - aHits
    })
    .slice(0, limit)
    .map(c => c.entry)
}

function extractKeywords(text: string): string[] {
  // 中文：提取 2-4 字连续片段
  // 英文：提取 >2 字母的单词
  const clean = text.replace(/[^一-鿿\w]/g, ' ')
  const words = clean.split(/\s+/).filter(w => w.length > 1)
  const result = new Set<string>()

  // 中文 N-gram
  const chinese = text.replace(/[^一-鿿]/g, '')
  for (let i = 0; i < chinese.length - 1; i++) {
    for (const size of [2, 3, 4]) {
      if (i + size <= chinese.length) result.add(chinese.slice(i, i + size))
    }
  }

  // 英文/混合词
  for (const w of words) {
    if (w.length >= 2) result.add(w.toLowerCase())
  }

  return [...result].slice(0, 10)
}

// ── CRUD（照搬 Hermes）────────────────────────────────────

export function memoryAdd(
  store: MemoryStore,
  target: 'memory' | 'user',
  content: string,
): { success: boolean; error?: string; usage?: string; entries?: string[] } {
  // 安全扫描
  const scan = scanContent(content)
  if (!scan.ok) return { success: false, error: `安全扫描未通过: ${scan.threat}` }

  const entries = target === 'memory' ? store.memoryEntries : store.userEntries
  const limit = target === 'memory' ? store.memoryCharLimit : store.userCharLimit
  const currentTotal = charCount(joinEntries(entries))
  const newTotal = currentTotal + charCount(`§ ${content}`)

  if (newTotal > limit) {
    return {
      success: false,
      error: `记忆空间不足。当前 ${currentTotal}/${limit} 字符，添加本条需要 ${newTotal} 字符。请先 remove 或 replace 旧条目。`,
      usage: `${currentTotal}/${limit}`,
      entries: [...entries],
    }
  }

  entries.push(content)
  return { success: true }
}

export function memoryReplace(
  store: MemoryStore,
  target: 'memory' | 'user',
  oldText: string,
  newText: string,
): { success: boolean; error?: string } {
  const scan = scanContent(newText)
  if (!scan.ok) return { success: false, error: `安全扫描未通过: ${scan.threat}` }

  const entries = target === 'memory' ? store.memoryEntries : store.userEntries
  const idx = entries.findIndex(e => e.includes(oldText))
  if (idx === -1) return { success: false, error: `未找到包含 "${oldText}" 的条目` }

  entries[idx] = newText
  return { success: true }
}

export function memoryRemove(
  store: MemoryStore,
  target: 'memory' | 'user',
  oldText: string,
): { success: boolean; error?: string } {
  const entries = target === 'memory' ? store.memoryEntries : store.userEntries
  const idx = entries.findIndex(e => e.includes(oldText))
  if (idx === -1) return { success: false, error: `未找到包含 "${oldText}" 的条目` }

  entries.splice(idx, 1)
  return { success: true }
}

export function memoryRead(
  store: MemoryStore,
  target: 'memory' | 'user' | 'both',
): string {
  if (target === 'memory') return joinEntries(store.memoryEntries)
  if (target === 'user') return joinEntries(store.userEntries)
  return `## MEMORY\n${joinEntries(store.memoryEntries)}\n\n## USER\n${joinEntries(store.userEntries)}`
}

// ── 持久化（原子写入磁盘）──────────────────────────────────

export function persistMemoryFiles(
  store: MemoryStore,
  memDir: string,
): void {
  const memPath = path.join(memDir, 'MEMORY.md')
  const userPath = path.join(memDir, 'USER.md')
  atomicWrite(memPath, joinEntries(store.memoryEntries))
  atomicWrite(userPath, joinEntries(store.userEntries))
}

// ── 快照（用于 Prompt 注入）────────────────────────────────

export function getSnapshot(store: MemoryStore): { memory: string; user: string } {
  // 实时从 live entries 构建快照，不在会话启动时冻结
  return {
    memory: joinEntries(store.memoryEntries),
    user: joinEntries(store.userEntries),
  }
}
