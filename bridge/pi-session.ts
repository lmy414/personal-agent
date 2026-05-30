import { createAgentSession, ModelRegistry } from '@pi/coding-agent'
import type { CreateAgentSessionResult } from '@pi/coding-agent'
import type { Model } from '@pi/ai'

type AgentSessionType = CreateAgentSessionResult['session']

// ========== 元信息 ==========

export interface PiSessionMeta {
  id: string
  modelName: string
  thinkingLevel: string
  title: string
  createdAt: number
  roundCount: number
}

interface SessionEntry {
  session: AgentSessionType
  meta: PiSessionMeta
}

const sessions = new Map<string, SessionEntry>()

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
  if (!registry) return []
  return registry.getAll().map((m) => ({
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

  const meta: PiSessionMeta = {
    id: sessionId,
    modelName: session.model?.id ?? modelName,
    thinkingLevel: options.thinkingLevel ?? 'medium',
    title: `会话 ${new Date().toLocaleDateString('zh-CN')}`,
    createdAt: Date.now(),
    roundCount: 0,
  }

  sessions.set(sessionId, { session, meta })

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

// ========== 模型工具 ==========

export function resolveModel(sessionId: string, modelName: string): Model<any> {
  const entry = sessions.get(sessionId)
  if (!entry) throw new Error(`Session not found: ${sessionId}`)
  return resolveModelFromRegistry(entry.session.modelRegistry, modelName)
}

export function getModelRegistry(sessionId: string): ModelRegistry | undefined {
  return sessions.get(sessionId)?.session.modelRegistry
}
