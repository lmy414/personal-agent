/**
 * pa-mio — 澪号 Harness v2
 *
 * 基于 Hermes SOUL.md + SillyTavern 分层注入。
 * 只做三件事：
 *   1. 加载 SOUL.md + MEMORY.md / USER.md 快照
 *   2. 4 层 Prompt 组装（before_agent_start）
 *   3. 记忆写入工具（message_end 模式检测）
 */
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import fs from 'fs'
import path from 'path'
import { createMemoryStore, searchEntries, memoryAdd, persistMemoryFiles, getSnapshot } from '../shared/memory-store'

// ── 路径 ──────────────────────────────────────────────────

const HARNESS_DIR = 'D:/claude/personal-agent/mio-harness'
const SOUL_PATH = path.join(HARNESS_DIR, 'SOUL.md')
const MEM_DIR = path.join(HARNESS_DIR, 'memories')

// ── SOUL.md 加载（每次消息实时读）──────────────────────────

function loadSoul(): string {
  try {
    return fs.readFileSync(SOUL_PATH, 'utf-8').trim()
  } catch {
    console.error('[pa-mio] SOUL.md 读取失败')
    return '你是澪号。Mirror 的搭档。'
  }
}

// ── Prompt 组装 ───────────────────────────────────────────

function assemblePrompt(userMessage: string, piSystemPrompt: string, store: ReturnType<typeof createMemoryStore>): string {
  const snap = getSnapshot(store)

  const layers: string[] = []

  // Layer 0: SOUL.md（绝对顶部）
  layers.push(loadSoul())

  // Layer 1: 记忆快照（会话启动冻结）
  const recallParts: string[] = []
  if (snap.memory) recallParts.push(snap.memory)
  if (snap.user) recallParts.push(snap.user)
  if (recallParts.length) {
    layers.push(
      '<recall>\n[系统提示：以下是记忆上下文，不是用户的新输入]\n\n' +
      recallParts.join('\n\n') +
      '\n</recall>',
    )
  }

  // Layer 2: 注入上下文（本轮检索 + 工具结果占位）
  const retrieved = searchEntries(store, userMessage, 'both', 3)
  const injectedParts: string[] = []
  if (retrieved.length) {
    injectedParts.push('<recall>\n' + retrieved.map(e => `§ ${e}`).join('\n') + '\n</recall>')
  }
  if (injectedParts.length) {
    layers.push(injectedParts.join('\n\n'))
  }

  // Layer 3: 工具定义 + Skill 描述（Pi 注入 + 记忆工具说明）
  layers.push(
    '[运行环境]\n' + piSystemPrompt + '\n\n' +
    '[记忆工具]\n' +
    '你有持久记忆能力。当需要记住一个事实时，在回复末尾附加：\n' +
    '<memory-add target="memory|user">事实内容（声明式，不要指令式）</memory-add>\n' +
    '这条标签会被自动处理并从回复中移除。',
  )

  return layers.join('\n\n')
}

// ── 记忆写入标签检测 ──────────────────────────────────────

const MEMORY_ADD_RE = /<memory-add\s+target="(memory|user)">([\s\S]*?)<\/memory-add>/g

function processMemoryTags(content: string, store: ReturnType<typeof createMemoryStore>): string {
  let cleaned = content
  let wroteMemory = false

  // Reset lastIndex since we're reusing a global regex
  MEMORY_ADD_RE.lastIndex = 0
  let match: RegExpExecArray | null
  const matches: Array<{ target: 'memory' | 'user'; fact: string }> = []

  while ((match = MEMORY_ADD_RE.exec(content)) !== null) {
    matches.push({ target: match[1] as 'memory' | 'user', fact: match[2].trim() })
  }

  for (const { target, fact } of matches) {
    if (fact) {
      const result = memoryAdd(store, target, fact)
      if (result.success) {
        console.log(`[pa-mio] memory add (${target}): ${fact.slice(0, 50)}...`)
        wroteMemory = true
      } else {
        console.warn(`[pa-mio] memory add failed: ${result.error}`)
      }
    }
    cleaned = cleaned.replace(
      new RegExp(`<memory-add\\s+target="${target}">[\\s\\S]*?<\\/memory-add>`, 'g'),
      '',
    )
  }

  if (wroteMemory) persistMemoryFiles(store, MEM_DIR)
  return cleaned.trim()
}

// ── 注册 ──────────────────────────────────────────────────

export default function register(api: ExtensionAPI) {
  console.log('[pa-mio] 澪号 Harness v2 已加载')

  let store = createMemoryStore(MEM_DIR)

  // ════════════════════════════════════════════════
  // before_agent_start: 组装 Prompt
  // ════════════════════════════════════════════════
  api.on('before_agent_start', (event) => {
    const mioPrompt = assemblePrompt(
      event.prompt || '',
      event.systemPrompt || '',
      store,
    )
    console.log('[pa-mio] prompt assembled,', mioPrompt.length, 'chars')
    return { systemPrompt: mioPrompt }
  })

  // ════════════════════════════════════════════════
  // message_end: 检测记忆写入标签
  // ════════════════════════════════════════════════
  api.on('message_end', (event) => {
    const msg = event.message as any
    if (!msg || msg.role !== 'assistant') return
    const content = typeof msg.content === 'string' ? msg.content : ''
    if (!content) return

    // 检测 <memory-add> 标签并处理
    if (content.includes('<memory-add')) {
      const cleaned = processMemoryTags(content, store)
      if (cleaned !== content) {
        ;(msg as any).content = cleaned
      }
    }
  })

  // ════════════════════════════════════════════════
  // session_start: 重置快照（重新加载磁盘）
  // ════════════════════════════════════════════════
  api.on('session_start', () => {
    store = createMemoryStore(MEM_DIR)
    console.log('[pa-mio] session reset, memory snapshot refreshed')
  })

  // ════════════════════════════════════════════════
  // 工具执行反馈（保留现有 UI 状态提示）
  // ════════════════════════════════════════════════
  api.on('tool_execution_start', (_event, ctx) => {
    const name = _event.toolName
    const label = name === 'bash' ? '执行命令' : name === 'read' ? '读取文件' : name
    ctx.ui.setStatus('mio-tool', `🔧 ${label}...`)
    ctx.ui.setWorkingVisible(true)
    ctx.ui.setWorkingMessage(`${label}中...`)
  })

  api.on('tool_execution_end', (_event, ctx) => {
    ctx.ui.setStatus('mio-tool', undefined)
    ctx.ui.setWorkingVisible(false)
    ctx.ui.setWorkingMessage(undefined)
  })
}
