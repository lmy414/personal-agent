import { createAgentSession, ModelRegistry } from '@pi/coding-agent'
import type { CreateAgentSessionResult } from '@pi/coding-agent'
import type { Model } from '@pi/ai'
import { getDB } from './db'

type AgentSessionType = CreateAgentSessionResult['session']

// ========== 元信息 ==========

export interface PiSessionMeta {
  id: string
  modelName: string
  thinkingLevel: string
  title: string
  createdAt: number
  roundCount: number
  contextWindow: number
}

interface SessionEntry {
  session: AgentSessionType
  meta: PiSessionMeta
}

const sessions = new Map<string, SessionEntry>()

// 全局缓存 model registry（首次创建 Pi session 时写入，供 model.list 等无 session 场景使用）
let cachedRegistry: ModelRegistry | null = null

// ========== 模型名映射（仅作参考，主逻辑从 registry 动态获取）==========

// 旧版硬编码映射，已废弃。保留为文档说明，不再参与任何运行时逻辑。
// const MODEL_MAP: Record<string, { provider: string; modelId: string }> = {
//   'deepseek-v3': { provider: 'deepseek', modelId: 'deepseek-v4-pro' },
//   'deepseek-v4-pro': { provider: 'deepseek', modelId: 'deepseek-v4-pro' },
//   'deepseek-v4-flash': { provider: 'deepseek', modelId: 'deepseek-v4-flash' },
//   'deepseek-r1': { provider: 'deepseek', modelId: 'deepseek-v4-flash' },
// }

function resolveModelFromRegistry(registry: ModelRegistry, modelName: string): Model<any> {
  // 优先从 registry 直接查找匹配 modelName
  const all = registry.getAvailable()
  if (all.length === 0) {
    throw new Error(`No models available. Check DEEPSEEK_API_KEY or other provider credentials.`)
  }
  const match = all.find((m) => m.id === modelName || m.name === modelName)
  if (match) return match
  // Fallback: 返回第一个可用模型
  return all[0]
}

export function getAvailableModels(registry?: ModelRegistry): { id: string; name: string; contextWindow: number }[] {
  const r = registry ?? cachedRegistry
  if (!r) return []
  return r.getAll().map((m) => ({
    id: m.id ?? m.name,
    name: m.name,
    contextWindow: (m as any).contextWindow ?? 0,
  }))
}

// ========== 会话生命周期 ==========

export async function createPiSession(options: {
  modelName?: string
  thinkingLevel?: 'low' | 'medium' | 'high'
  sessionId?: string
}): Promise<{ sessionId: string; model: string; thinkingLevel: string }> {
  const modelName = options.modelName ?? 'deepseek-v3'

  const result = await createAgentSession({
    thinkingLevel: options.thinkingLevel ?? 'medium',
    cwd: process.cwd(),
  })

  const session = result.session
  const sessionId = options.sessionId ?? crypto.randomUUID()

  // Switch to requested model if different from default
  if (modelName !== 'deepseek-v3') {
    try {
      const model = resolveModelFromRegistry(session.modelRegistry, modelName)
      await session.setModel(model)
    } catch (err) {
      console.warn(`[pi-session] failed to set model ${modelName}:`, err)
    }
  }

  const contextWindow = (session.model as any)?.contextWindow ?? 0

  // 从 SQLite 恢复 roundCount（桥接重启后仍保留）
  let restoredRoundCount = 0
  try {
    const db = getDB()
    const row = db.prepare(`
      SELECT COUNT(*) as cnt FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.session_id = ? AND m.role = 'user'
    `).get(sessionId) as { cnt: number } | undefined
    restoredRoundCount = row?.cnt ?? 0
  } catch { /* DB 未初始化或查询失败，使用 0 */ }

  const meta: PiSessionMeta = {
    id: sessionId,
    modelName: session.model?.id ?? modelName,
    thinkingLevel: options.thinkingLevel ?? 'medium',
    title: `会话 ${new Date().toLocaleDateString('zh-CN')}`,
    createdAt: Date.now(),
    roundCount: restoredRoundCount,
    contextWindow,
  }

  sessions.set(sessionId, { session, meta })

  // 缓存首个 model registry，供 model.list 等无 session 请求使用
  if (!cachedRegistry) {
    cachedRegistry = session.modelRegistry
  }

  console.log(`[pi-session] created session ${sessionId} with model ${meta.modelName}`)

  return { sessionId, model: meta.modelName, thinkingLevel: meta.thinkingLevel }
}

export function getPiSession(sessionId: string): AgentSessionType | undefined {
  return sessions.get(sessionId)?.session
}

export function removePiSession(sessionId: string): void {
  const entry = sessions.get(sessionId)
  if (entry) {
    entry.session.dispose()
    sessions.delete(sessionId)
    console.log(`[pi-session] disposed session ${sessionId}`)
  }
}

export function disposeAllPiSessions(): void {
  for (const [id, entry] of sessions) {
    entry.session.dispose()
    console.log(`[pi-session] disposed session ${id}`)
  }
  sessions.clear()
}

// ========== 元信息 ==========

export function getSessionMeta(sessionId: string): PiSessionMeta | undefined {
  return sessions.get(sessionId)?.meta
}

export function getAllSessionMeta(): PiSessionMeta[] {
  return Array.from(sessions.values()).map((e) => e.meta)
}

export function updateSessionMeta(sessionId: string, updates: Partial<PiSessionMeta>): void {
  const entry = sessions.get(sessionId)
  if (entry) {
    Object.assign(entry.meta, updates)
  }
}

// ========== 上下文工具 ==========

/** 安全获取 contextWindow — 多层 fallback，最终确保返回有效数字 */
export function getSafeContextWindow(sessionId: string): number {
  const entry = sessions.get(sessionId)
  const session = entry?.session
  const meta = entry?.meta
  const ctx = (session as any)?.getContextUsage?.() as { contextWindow?: number } | undefined
  const modelCw = (session as any)?.model?.contextWindow
  const raw = ctx?.contextWindow ?? modelCw ?? meta?.contextWindow ?? 0
  return Number.isFinite(raw) && raw > 0 ? raw : 0
}

// ========== 模型工具 ==========

export function resolveModel(sessionId: string, modelName: string): Model<any> {
  const entry = sessions.get(sessionId)
  if (!entry) throw new Error(`Session not found: ${sessionId}`)
  return resolveModelFromRegistry(entry.session.modelRegistry, modelName)
}

export function getModelRegistry(sessionId: string): ModelRegistry | undefined {
  return sessions.get(sessionId)?.session.modelRegistry
}
