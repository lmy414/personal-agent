import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { getDB } from '../db'

interface ModelConfig {
  thinkingLevel?: string
  compactThreshold?: number
  enabled?: boolean
  visible?: boolean
}

function getModelConfigs(): Record<string, ModelConfig> {
  const db = getDB()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'model_configs'").get() as
    | { value: string }
    | undefined
  if (!row?.value) return {}
  try { return JSON.parse(row.value) } catch { return {} }
}

function saveModelConfigs(configs: Record<string, ModelConfig>): void {
  const db = getDB()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'model_configs', JSON.stringify(configs),
  )
}

export function handleModelConfigure(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as {
    modelId: string; thinkingLevel?: string; compactThreshold?: number; enabled?: boolean; visible?: boolean
  }

  if (!payload.modelId) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'INVALID_MODEL', message: 'modelId is required', recoverable: true },
    }))
    return
  }

  const configs = getModelConfigs()
  const current = configs[payload.modelId] ?? {}
  const updated: ModelConfig = { ...current }

  if (payload.thinkingLevel !== undefined) updated.thinkingLevel = payload.thinkingLevel
  if (payload.compactThreshold !== undefined) updated.compactThreshold = payload.compactThreshold
  if (payload.enabled !== undefined) updated.enabled = payload.enabled
  if (payload.visible !== undefined) updated.visible = payload.visible

  configs[payload.modelId] = updated
  saveModelConfigs(configs)

  ws.send(JSON.stringify({
    type: 'model.configured',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: {
      modelId: payload.modelId,
      thinkingLevel: updated.thinkingLevel,
      compactThreshold: updated.compactThreshold,
      enabled: updated.enabled,
      visible: updated.visible,
    },
  }))

  // 推送完整 settings 让前端 modelConfigs() 重新计算
  const db = getDB()
  const all = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  ws.send(JSON.stringify({
    type: 'settings.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { entries: all },
  }))
}
