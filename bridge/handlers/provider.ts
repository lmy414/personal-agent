import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { getDB } from '../db'
import { getPiSession, getAvailableModels } from '../pi-session'
import { discoverAgents } from './agent'

// ── 厂商配置读写 ──

interface ProviderConfig {
  id: string
  name: string
  apiUrl?: string
  apiKey?: string
  active: boolean
}

function getProviders(): ProviderConfig[] {
  const db = getDB()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'providers'").get() as
    | { value: string }
    | undefined
  if (!row?.value) return []
  try { return JSON.parse(row.value) } catch { return [] }
}

function saveProviders(providers: ProviderConfig[]): void {
  const db = getDB()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'providers', JSON.stringify(providers),
  )
}

// ── Provider CRUD ──

export function handleProviderSave(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as ProviderConfig
  if (!payload.id || !payload.name) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'INVALID_PROVIDER', message: 'id and name are required', recoverable: true },
    }))
    return
  }

  const providers = getProviders()
  const idx = providers.findIndex((p) => p.id === payload.id)
  const provider: ProviderConfig = {
    id: payload.id,
    name: payload.name,
    apiUrl: payload.apiUrl,
    apiKey: payload.apiKey,
    active: payload.active ?? true,
  }

  if (idx >= 0) {
    providers[idx] = provider
  } else {
    providers.push(provider)
  }
  saveProviders(providers)

  // 回复
  ws.send(JSON.stringify({
    type: 'provider.saved',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { provider },
  }))

  // 触发模型发现
  try {
    const session = getPiSession(msg.sessionId)
    const models = getAvailableModels(session?.modelRegistry)
    // 如果 providers 中有 apiKey，临时注入环境变量让 Pi 能发现模型
    if (provider.apiKey && provider.apiKey.trim()) {
      const envKeyMap: Record<string, string> = {
        deepseek: 'DEEPSEEK_API_KEY', anthropic: 'ANTHROPIC_API_KEY',
        openai: 'OPENAI_API_KEY', google: 'GEMINI_API_KEY',
        groq: 'GROQ_API_KEY', xai: 'XAI_API_KEY',
      }
      const envKey = envKeyMap[provider.id]
      if (envKey && !process.env[envKey]) {
        process.env[envKey] = provider.apiKey.trim()
        console.log(`[provider] injected ${envKey} from saved provider config`)
      }
    }
    // 触发 Agent 重新发现 (会使用新的 env var)
    const agents = discoverAgents()
    console.log(`[provider] ${provider.id} saved, ${agents.length} agents after discovery`)
  } catch (err) {
    console.warn('[provider] model discovery after save failed:', err)
  }

  // 推送完整 providers 列表
  ws.send(JSON.stringify({
    type: 'settings.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { entries: getAllSettingsEntries() },
  }))
}

export function handleProviderDelete(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { id: string }
  const providers = getProviders()
  const provider = providers.find((p) => p.id === payload.id)

  if (!provider) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'PROVIDER_NOT_FOUND', message: `Provider not found: ${payload.id}`, recoverable: true },
    }))
    return
  }

  const providerName = provider.name
  // 移除厂商
  saveProviders(providers.filter((p) => p.id !== payload.id))

  // 查找该厂商下的 agent 并重新分配模型
  const db = getDB()
  const affectedAgents = db.prepare(
    'SELECT id, name FROM agents WHERE provider = ?',
  ).all(payload.id) as { id: string; name: string }[]

  let fallbackModel = '(无可用模型)'
  if (affectedAgents.length > 0) {
    const remainingProviders = getProviders()
    if (remainingProviders.length > 0) {
      const session = getPiSession(msg.sessionId)
      const models = getAvailableModels(session?.modelRegistry)
      // 找第一个可用模型
      for (const rp of remainingProviders) {
        const firstModel = models.find((m) => m.provider === rp.id || m.name.includes(rp.name))
        if (firstModel) {
          fallbackModel = `${rp.name} / ${firstModel.name}`
          // 批量更新 agent 的 provider + model
          db.prepare(
            'UPDATE agents SET provider = ?, model_id = ? WHERE provider = ?',
          ).run(rp.id, firstModel.id, payload.id)
          break
        }
      }
    }
    console.log(`[provider] deleted ${providerName}, ${affectedAgents.length} agents reassigned to ${fallbackModel}`)
  }

  ws.send(JSON.stringify({
    type: 'provider.deleted',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: {
      id: payload.id,
      affectedAgents: affectedAgents.length,
      fallbackModel,
    },
  }))

  // 广播 agent 更新
  const allAgents = db.prepare(`
    SELECT a.*, COUNT(c.id) as session_count
    FROM agents a LEFT JOIN conversations c ON c.agent_id = a.id
    GROUP BY a.id ORDER BY a.is_default DESC, a.created_at ASC
  `).all() as any[]
  const agents = allAgents.map((r: any) => ({
    id: r.id, name: r.name, provider: r.provider, modelId: r.model_id,
    avatarColor: r.avatar_color, roleDescription: r.role_description,
    isDefault: r.is_default === 1, createdAt: new Date(r.created_at).getTime(),
    sessionCount: r.session_count,
  }))

  ws.send(JSON.stringify({
    type: 'agent.list',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { agents },
  }))

  // 推送更新后的 settings
  ws.send(JSON.stringify({
    type: 'settings.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { entries: getAllSettingsEntries() },
  }))
}

// ── 辅助 ──

function getAllSettingsEntries(): { key: string; value: string }[] {
  const db = getDB()
  return db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
}
