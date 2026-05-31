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
  // 按 model.provider 分组，仅返回已认证厂商的模型
  const providerNames: Record<string, string> = {
    deepseek: 'DeepSeek', anthropic: 'Anthropic', openai: 'OpenAI',
    google: 'Google Gemini', groq: 'Groq', xai: 'xAI', mistral: 'Mistral',
    openrouter: 'OpenRouter', cerebras: 'Cerebras', fireworks: 'Fireworks',
    together: 'Together AI', minimax: 'MiniMax', moonshotai: 'Moonshot AI',
    kimi: 'Kimi', zai: 'ZAI',
  }
  const providers = new Map<string, { id: string; name: string; models: { id: string; name: string; contextWindow: number }[] }>()
  for (const m of models) {
    const provId = m.provider || 'unknown'
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
