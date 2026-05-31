import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { getDB } from '../db'
import { getPiSession, getAvailableModels } from '../pi-session'

export function handleSettingsGet(_msg: ClientMessage, ws: WebSocket): void {
  const db = getDB()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  ws.send(JSON.stringify({
    type: 'settings.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { entries: rows },
  }))
}

export function handleSettingsSet(msg: ClientMessage, ws: WebSocket): void {
  const { key, value } = msg.payload as { key: string; value: string }
  const db = getDB()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  handleSettingsGet(msg, ws)
}

export function handleSettingsDiscoverModels(msg: ClientMessage, ws: WebSocket): void {
  const session = getPiSession(msg.sessionId)
  const models = getAvailableModels(session?.modelRegistry)

  // 只收录环境变量中实际配置了 API Key 的厂商
  const envKeyMap: Record<string, string> = {
    deepseek: 'DEEPSEEK_API_KEY', anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY', google: 'GEMINI_API_KEY',
    groq: 'GROQ_API_KEY', xai: 'XAI_API_KEY', mistral: 'MISTRAL_API_KEY',
    openrouter: 'OPENROUTER_API_KEY', cerebras: 'CEREBRAS_API_KEY',
    fireworks: 'FIREWORKS_API_KEY', together: 'TOGETHER_API_KEY',
    minimax: 'MINIMAX_API_KEY', moonshotai: 'MOONSHOT_API_KEY',
    kimi: 'KIMI_API_KEY', zai: 'ZAI_API_KEY',
  }
  const providerNames: Record<string, string> = {
    deepseek: 'DeepSeek', anthropic: 'Anthropic', openai: 'OpenAI',
    google: 'Google Gemini', groq: 'Groq', xai: 'xAI', mistral: 'Mistral',
    openrouter: 'OpenRouter', cerebras: 'Cerebras', fireworks: 'Fireworks',
    together: 'Together AI', minimax: 'MiniMax', moonshotai: 'Moonshot AI',
    kimi: 'Kimi', zai: 'ZAI',
  }

  // 检查哪些厂商实际设置了环境变量
  const activeProviders = new Set<string>()
  for (const [provId, envKey] of Object.entries(envKeyMap)) {
    if (process.env[envKey]) activeProviders.add(provId)
  }

  const providers = new Map<string, { id: string; name: string; models: { id: string; name: string; contextWindow: number }[] }>()
  for (const m of models) {
    const provId = m.provider || 'unknown'
    if (!activeProviders.has(provId)) continue  // 跳过未配置 Key 的厂商
    if (!providers.has(provId)) {
      providers.set(provId, { id: provId, name: providerNames[provId] ?? provId, models: [] })
    }
    providers.get(provId)!.models.push(m)
  }
  const db = getDB()
  const providerList = Array.from(providers.values())
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('providers', JSON.stringify(providerList))
  handleSettingsGet(msg, ws)
}
