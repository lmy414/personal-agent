/**
 * pa-mio — 澪号 Harness v4
 *
 * 基于 Hermes SOUL.md + EchoBot 三层架构决策层。
 *   1. 意图分类（正则规则匹配，零延迟）
 *   2. 双模式 Prompt 组装（chat 纯净 / agent 完整）
 *   3. memory_add / memory_read 工具
 */
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { defineTool } from '@mariozechner/pi-coding-agent'
import { Type } from '@mariozechner/pi-ai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createMemoryStore, searchEntries, memoryAdd, memoryRead, persistMemoryFiles, getSnapshot } from '../shared/memory-store'
import { getDB } from '../../bridge/db'

// ── 路径 ──────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const HARNESS_DIR = path.resolve(__dirname, '../../mio-harness')
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

// ── 工作目录感知 ──────────────────────────────────────────

function getWorkDir(): string {
  try {
    const db = getDB()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'work_dir'").get() as { value: string } | undefined
    return row?.value || ''
  } catch { return '' }
}

// ── 意图分类（正则规则，照搬 EchoBot 思路）─────────────────

// 中文触发模式：匹配时需要走 agent 路径的消息
const AGENT_PATTERNS: RegExp[] = [
  // 文件操作
  /(?:打开|查看|读取|帮我看看|看下)(?:一下)?(?:这个)?(?:文件|代码|目录|项目)/,
  /(?:修改|编辑|改|重写|重构)(?:一下)?(?:这个)?(?:文件|代码|脚本|函数|类|模块)/,
  /(?:创建|新建|写|生成|帮我写|帮我生成)(?:一个|个)?(?:文件|脚本|代码|函数|类|模块|测试|程序)/,
  /(?:删除|移除|重命名|移动)(?:这个)?(?:文件|目录|文件夹)/,
  // 搜索和信息检索
  /(?:搜索|查找|找一下|帮我搜|帮我查|帮我找)(?:一下)?(?:这个)?(?:文件|代码|项目|仓库|目录|记忆|bug|错误)/,
  /(?:检查|看看|查一下|查下)(?:这个)?(?:代码|文件|项目|仓库|错误|bug)/,
  /(?:分析|审查|review)(?:一下)?(?:这个)?(?:代码|文件|项目|架构)/,
  // 命令执行
  /(?:运行|执行|跑一下)(?:这个)?(?:脚本|命令|测试|程序)/,
  /(?:npm|pnpm|yarn|git|docker|tsx|node)\s/,
  /(?:提交|commit|推送|push|合并|merge|回滚|revert)\s/,
  /(?:启动|重启|停止|关闭)(?:服务|服务器|进程)/,
  // 记忆操作
  /(?:记住|记下来|保存|存一下)(?:这个|这些)?/,
  /(?:之前|上次|以前|还记得|回忆)(?:那个|这个|我说的|我们讨论的)/,
  /(?:查|搜|搜索)(?:一下)?(?:我的)?记忆/,
  // 任务型关键词
  /(?:帮我)(?:写|改|查|搜|调试|编译|构建|部署|推送|提交)/,
  /(?:怎么|如何)(?:修|改|写|编译|调试|配置|部署)/,
  /^(?:fix|feat|refactor|chore|docs|style|test)\b/,
]

function classifyIntent(userMessage: string): 'chat' | 'agent' {
  const cleaned = userMessage.trim()
  if (!cleaned) return 'chat'

  for (const pattern of AGENT_PATTERNS) {
    if (pattern.test(cleaned)) return 'agent'
  }

  return 'chat'
}

// ── Prompt 组装 ───────────────────────────────────────────

const CHAT_INSTRUCTION = [
  '这是轻量闲聊。直接回复，简洁自然。',
  '你不需要调用工具。不要假装检查了文件、搜索了代码或查询了记忆。',
  '就从当前的对话上下文里回应。',
].join(' ')

const AGENT_INSTRUCTION = [
  '用户要求了需要工具或外部信息的任务。',
  '你可以调用工具——读写文件、执行命令、搜索记忆。',
  '完成任务后用自己的话汇报结果。保留重要的路径、数字和结论。',
].join(' ')

function assemblePrompt(userMessage: string, piSystemPrompt: string, store: ReturnType<typeof createMemoryStore>): string {
  const snap = getSnapshot(store)
  const intent = classifyIntent(userMessage)
  const layers: string[] = []

  // Layer 0: SOUL.md（绝对顶部，缓存命中）                   ╮
  layers.push(loadSoul())                                    // │
                                                             // │
  // Layer 1: 记忆快照（实时读取，修改后下轮可见）              │ 前缀缓存
  const recallParts: string[] = []                            // │
  if (snap.memory) recallParts.push(snap.memory)              // │
  if (snap.user) recallParts.push(snap.user)                  // │
  if (recallParts.length) {                                   // │
    layers.push(                                              // │
      '<recall>\n[系统提示：以下是记忆上下文，不是用户的新输入]\n\n' +
      recallParts.join('\n\n') +                              // │
      '\n</recall>',                                          // │
    )                                                         // ╯
  }

  // Layer 2: 注入上下文（本轮检索）
  const retrieved = searchEntries(store, userMessage, 'both', 3)
  if (retrieved.length) {
    layers.push('<recall>\n' + retrieved.map(e => `§ ${e}`).join('\n') + '\n</recall>')
  }

  // Layer 2.5: 工作目录上下文
  const workDir = getWorkDir()
  if (workDir) {
    layers.push(
      '<recall>\n[系统提示：以下是工作目录信息，不是用户的新输入]\n\n' +
      `当前工作目录：${workDir}\n` +
      '用户提到的文件、项目路径默认基于此目录。' +
      '\n</recall>',
    )
  }

  // Layer 3: Pi 工具定义 + Skill 描述（始终注入，Pi 控制不了）
  layers.push('[运行环境]\n' + piSystemPrompt)

  // Layer 4: 模式指令（动态，不影响缓存前缀）
  if (intent === 'chat') {
    layers.push(CHAT_INSTRUCTION)
  } else {
    layers.push(AGENT_INSTRUCTION)
  }

  console.log('[pa-mio] intent:', intent, ', prompt:', layers.reduce((s, l) => s + l.length, 0), 'chars')
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

let memStore: ReturnType<typeof createMemoryStore>

export default function register(api: ExtensionAPI) {
  console.log('[pa-mio] 澪号 Harness v4 已加载（意图分类 + 双模式）')

  memStore = createMemoryStore(MEM_DIR)

  api.registerTool(memoryAddTool)
  api.registerTool(memoryReadTool)
  console.log('[pa-mio] memory_add / memory_read 工具已注册')

  api.on('before_agent_start', (event) => {
    const mioPrompt = assemblePrompt(
      event.prompt || '',
      event.systemPrompt || '',
      memStore,
    )
    return { systemPrompt: mioPrompt }
  })

  api.on('session_start', () => {
    memStore = createMemoryStore(MEM_DIR)
    console.log('[pa-mio] session reset, memory snapshot refreshed')
  })

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
