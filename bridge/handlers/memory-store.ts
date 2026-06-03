/**
 * bridge 侧 MemoryStore — 只读 + 检索，用于前端记忆浏览。
 * 写入操作由 pa-mio 负责（Pi 进程内）。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MEM_DIR = path.resolve(__dirname, '../../mio-harness/memories')

function splitEntries(text: string): string[] {
  return text
    .split('§')
    .map(e => e.trim())
    .filter(e => e.length > 0)
}

function readFile(filePath: string): string {
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

export function getAllMemories(): MemoryEntry[] {
  const memText = readFile(path.join(MEM_DIR, 'MEMORY.md'))
  const userText = readFile(path.join(MEM_DIR, 'USER.md'))

  return [
    ...splitEntries(memText).map(e => ({ content: e, source: 'memory' as const })),
    ...splitEntries(userText).map(e => ({ content: e, source: 'user' as const })),
  ]
}

export function searchMemories(query: string): MemoryEntry[] {
  const all = getAllMemories()
  const q = query.toLowerCase()
  return all.filter(e => e.content.toLowerCase().includes(q))
}
