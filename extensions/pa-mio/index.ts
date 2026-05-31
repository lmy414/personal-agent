/**
 * pa-mio — 澪号 Harness v3
 *
 * 基于 Hermes SOUL.md + SillyTavern 分层注入。
 * 只做三件事：
 *   1. 加载 SOUL.md + MEMORY.md / USER.md 快照
 *   2. 4 层 Prompt 组装（before_agent_start）
 *   3. 注册 memory_add / memory_read 工具供 LLM 调用
 */
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { defineTool } from '@mariozechner/pi-coding-agent'
import { Type } from '@mariozechner/pi-ai'
import fs from 'fs'
import path from 'path'
import { createMemoryStore, searchEntries, memoryAdd, memoryRead, persistMemoryFiles, getSnapshot } from '../shared/memory-store'

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

  // Layer 3: Pi 工具定义 + Skill 描述
  layers.push('[运行环境]\n' + piSystemPrompt)

  return layers.join('\n\n')
}

// ── Memory 工具定义 ────────────────────────────────────────

const memoryAddTool = defineTool({
  name: 'memory_add',
  label: 'Add Memory',
  description:
    '向持久记忆中保存一个事实。MEMORY.md 存环境/项目信息，USER.md 存用户画像。' +
    '写声明式事实，不写命令式指令。MEMORY.md 上限 2200 字符，USER.md 上限 1375 字符，超限时操作会拒绝。',
  parameters: Type.Object({
    target: Type.String({
      description: '记忆目标：memory（MEMORY.md，环境/项目）或 user（USER.md，用户画像）',
    }),
    content: Type.String({
      description: '记忆内容。一个声明式事实。如 "Mirror 偏好 TypeScript 严格模式"',
    }),
  }),
  execute: async (_id, params, _signal, _onUpdate, _ctx) => {
    const target = params.target as 'memory' | 'user'
    if (target !== 'memory' && target !== 'user') {
      return { content: [{ type: 'text', text: 'target 必须是 memory 或 user' }], details: {} }
    }
    const result = memoryAdd(memStore, target, params.content as string)
    if (result.success) {
      persistMemoryFiles(memStore, MEM_DIR)
      const current = target === 'memory' ? memStore.memoryEntries.length : memStore.userEntries.length
      return { content: [{ type: 'text', text: `已保存到 ${target === 'memory' ? 'MEMORY.md' : 'USER.md'}（当前 ${current} 条）` }], details: {} }
    }
    return { content: [{ type: 'text', text: `保存失败：${result.error}\n当前条目：\n${(result.entries ?? []).map(e => `§ ${e}`).join('\n')}` }], details: {} }
  },
})

const memoryReadTool = defineTool({
  name: 'memory_read',
  label: 'Read Memory',
  description: '读取当前的 MEMORY.md 或 USER.md 全文内容。',
  parameters: Type.Object({
    target: Type.String({
      description: '要读取的目标：memory（MEMORY.md）、user（USER.md）、或 both（两者）',
    }),
  }),
  execute: async (_id, params) => {
    const target = (params.target as string) || 'both'
    if (target !== 'memory' && target !== 'user' && target !== 'both') {
      return { content: [{ type: 'text', text: 'target 必须是 memory、user 或 both' }], details: {} }
    }
    const text = memoryRead(memStore, target as 'memory' | 'user' | 'both')
    if (!text) return { content: [{ type: 'text', text: '（空）' }], details: {} }
    return { content: [{ type: 'text', text }], details: {} }
  },
})

// ── 注册 ──────────────────────────────────────────────────

// 在 register() 闭包内，供工具 execute 回调访问
let memStore: ReturnType<typeof createMemoryStore>

export default function register(api: ExtensionAPI) {
  console.log('[pa-mio] 澪号 Harness v3 已加载')

  memStore = createMemoryStore(MEM_DIR)

  // ════════════════════════════════════════════════
  // 注册 memory 工具
  // ════════════════════════════════════════════════
  api.registerTool(memoryAddTool)
  api.registerTool(memoryReadTool)
  console.log('[pa-mio] memory_add / memory_read 工具已注册')

  // ════════════════════════════════════════════════
  // before_agent_start: 组装 Prompt
  // ════════════════════════════════════════════════
  api.on('before_agent_start', (event) => {
    const mioPrompt = assemblePrompt(
      event.prompt || '',
      event.systemPrompt || '',
      memStore,
    )
    console.log('[pa-mio] prompt assembled,', mioPrompt.length, 'chars')
    return { systemPrompt: mioPrompt }
  })

  // ════════════════════════════════════════════════
  // session_start: 重置快照（重新加载磁盘）
  // ════════════════════════════════════════════════
  api.on('session_start', () => {
    memStore = createMemoryStore(MEM_DIR)
    console.log('[pa-mio] session reset, memory snapshot refreshed')
  })

  // ════════════════════════════════════════════════
  // 工具执行反馈（UI 状态提示）
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
