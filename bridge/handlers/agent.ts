import type { WebSocket } from 'ws'
import type { ClientMessage, AgentInfo } from '../protocol'
import { getDB } from '../db'
import { getAvailableModels, getPiSession } from '../pi-session'
import { createClientSet } from '../client-manager'
import { generateUUID } from '../protocol'

// ========== DB 操作 ==========

function dbGetAgents(): AgentInfo[] {
  const db = getDB()
  const rows = db.prepare(`
    SELECT a.*, COUNT(c.id) as session_count
    FROM agents a
    LEFT JOIN conversations c ON c.agent_id = a.id
    GROUP BY a.id
    ORDER BY a.is_default DESC, a.created_at ASC
  `).all() as {
    id: string; name: string; provider: string; model_id: string
    avatar_color: string; role_description: string; is_default: number
    created_at: string; session_count: number
  }[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    provider: r.provider,
    modelId: r.model_id,
    avatarColor: r.avatar_color,
    roleDescription: r.role_description,
    isDefault: r.is_default === 1,
    createdAt: new Date(r.created_at).getTime(),
    sessionCount: r.session_count,
  }))
}

function dbGetAgent(agentId: string): AgentInfo | undefined {
  return dbGetAgents().find((a) => a.id === agentId)
}

function dbInsertAgent(agent: AgentInfo): void {
  const db = getDB()
  db.prepare(`
    INSERT OR IGNORE INTO agents (id, name, provider, model_id, avatar_color, role_description, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agent.id,
    agent.name,
    agent.provider,
    agent.modelId,
    agent.avatarColor,
    agent.roleDescription,
    agent.isDefault ? 1 : 0,
    new Date(agent.createdAt).toISOString(),
  )
}

function dbUpdateAgent(agentId: string, updates: Partial<Pick<AgentInfo, 'name' | 'avatarColor' | 'roleDescription' | 'isDefault'>>): void {
  const db = getDB()
  const fields: string[] = []
  const values: unknown[] = []

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.avatarColor !== undefined) { fields.push('avatar_color = ?'); values.push(updates.avatarColor) }
  if (updates.roleDescription !== undefined) { fields.push('role_description = ?'); values.push(updates.roleDescription) }
  if (updates.isDefault !== undefined) { fields.push('is_default = ?'); values.push(updates.isDefault ? 1 : 0) }

  if (fields.length === 0) return
  values.push(agentId)
  db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

function dbDeleteAgent(agentId: string): void {
  const db = getDB()
  // 将该 Agent 下的会话取消关联（不级联删除会话）
  db.prepare('UPDATE conversations SET agent_id = NULL WHERE agent_id = ?').run(agentId)
  db.prepare('DELETE FROM agents WHERE id = ?').run(agentId)
}

// ========== 自动发现 ==========

const AGENT_AVATAR_COLORS = ['#7C3AED', '#10B981', '#F59E0B', '#0066FF', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4']

/** 首次启动或手动触发时，从 providers 自动生成 Agent */
export function discoverAgents(): AgentInfo[] {
  const db = getDB()
  const providersRow = db.prepare("SELECT value FROM settings WHERE key = 'providers'").get() as
    | { value: string }
    | undefined
  if (!providersRow?.value) return dbGetAgents()

  let providers: { id: string; name: string; models: { id: string; name: string; contextWindow: number }[] }[] = []
  try { providers = JSON.parse(providersRow.value) } catch { return dbGetAgents() }

  const existing = dbGetAgents()
  const existingKeys = new Set(existing.map((a) => `${a.provider}:${a.modelId}`))

  let createdCount = 0
  for (const provider of providers) {
    for (const model of provider.models) {
      const key = `${provider.id}:${model.id}`
      if (existingKeys.has(key)) continue

      const colorIndex = createdCount % AGENT_AVATAR_COLORS.length
      const agent: AgentInfo = {
        id: generateUUID(),
        name: model.name,
        provider: provider.id,
        modelId: model.id,
        avatarColor: AGENT_AVATAR_COLORS[colorIndex],
        roleDescription: '',
        isDefault: existing.length === 0 && createdCount === 0,
        createdAt: Date.now(),
        sessionCount: 0,
      }
      dbInsertAgent(agent)
      console.log(`[agent] auto-discovered: ${agent.name} (${agent.provider}/${agent.modelId})`)
      existingKeys.add(key)
      createdCount++
    }
  }

  return dbGetAgents()
}

// ========== 广播 ==========

export const agentClients = createClientSet()

/** @deprecated use agentClients.add() */
export const addAgentClient = (ws: WebSocket) => agentClients.add(ws)
/** @deprecated use agentClients.remove() */
export const removeAgentClient = (ws: WebSocket) => agentClients.remove(ws)

function broadcast(msg: object): void {
  agentClients.broadcast(JSON.stringify(msg))
}

// ========== Handlers ==========

export function handleAgentList(_msg: ClientMessage, ws: WebSocket): void {
  addAgentClient(ws)
  const agents = dbGetAgents()
  // 如果 DB 中无 Agent，触发自动发现
  if (agents.length === 0) {
    const discovered = discoverAgents()
    ws.send(JSON.stringify({
      type: 'agent.list',
      id: `srv-${Date.now()}`,
      sessionId: '',
      ts: Date.now(),
      payload: { agents: discovered },
    }))
    return
  }
  ws.send(JSON.stringify({
    type: 'agent.list',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { agents },
  }))
}

export function handleAgentCreate(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { name: string; provider: string; modelId: string; avatarColor?: string; roleDescription?: string }

  // 校验 provider + model 是否可用
  const session = getPiSession(msg.sessionId)
  const models = getAvailableModels(session?.modelRegistry)
  const modelExists = models.some((m) => m.id === payload.modelId || m.name === payload.modelId)
  if (!modelExists) {
    // 允许创建未验证的 agent（Pi 懒加载时可能 registry 未初始化），仅警告
    console.warn(`[agent] creating agent with unverified model: ${payload.provider}/${payload.modelId}`)
  }

  const existing = dbGetAgents()
  const isFirst = existing.length === 0

  const agent: AgentInfo = {
    id: generateUUID(),
    name: payload.name,
    provider: payload.provider,
    modelId: payload.modelId,
    avatarColor: payload.avatarColor ?? AGENT_AVATAR_COLORS[existing.length % AGENT_AVATAR_COLORS.length],
    roleDescription: payload.roleDescription ?? '',
    isDefault: isFirst,
    createdAt: Date.now(),
    sessionCount: 0,
  }

  dbInsertAgent(agent)

  const created = dbGetAgent(agent.id)
  if (!created) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'AGENT_CREATE_FAILED', message: 'Failed to create agent', recoverable: true },
    }))
    return
  }

  ws.send(JSON.stringify({
    type: 'agent.created',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { agent: created },
  }))
  broadcast({ type: 'agent.list', id: `srv-${Date.now()}`, sessionId: '', ts: Date.now(), payload: { agents: dbGetAgents() } })
}

export function handleAgentUpdate(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { agentId: string; name?: string; avatarColor?: string; roleDescription?: string }
  const existing = dbGetAgent(payload.agentId)
  if (!existing) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'AGENT_NOT_FOUND', message: `Agent not found: ${payload.agentId}`, recoverable: true },
    }))
    return
  }

  dbUpdateAgent(payload.agentId, {
    name: payload.name,
    avatarColor: payload.avatarColor,
    roleDescription: payload.roleDescription,
  })

  const updated = dbGetAgent(payload.agentId)
  if (!updated) return

  ws.send(JSON.stringify({
    type: 'agent.updated',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { agent: updated },
  }))
  broadcast({ type: 'agent.list', id: `srv-${Date.now()}`, sessionId: '', ts: Date.now(), payload: { agents: dbGetAgents() } })
}

export function handleAgentDelete(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { agentId: string }
  const existing = dbGetAgent(payload.agentId)
  if (!existing) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'AGENT_NOT_FOUND', message: `Agent not found: ${payload.agentId}`, recoverable: true },
    }))
    return
  }

  dbDeleteAgent(payload.agentId)

  ws.send(JSON.stringify({
    type: 'agent.deleted',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { agentId: payload.agentId },
  }))
  broadcast({ type: 'agent.list', id: `srv-${Date.now()}`, sessionId: '', ts: Date.now(), payload: { agents: dbGetAgents() } })
}

export function handleAgentSwitch(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { agentId: string }
  const agent = dbGetAgent(payload.agentId)
  if (!agent) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'AGENT_NOT_FOUND', message: `Agent not found: ${payload.agentId}`, recoverable: true },
    }))
    return
  }

  // 查找该 Agent 的最近 session
  const db = getDB()
  const recentSession = db.prepare(`
    SELECT session_id FROM conversations
    WHERE agent_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(payload.agentId) as { session_id: string } | undefined

  if (recentSession) {
    // 有历史 session → 切换过去
    ws.send(JSON.stringify({
      type: 'session.switch',
      id: `srv-${Date.now()}`,
      sessionId: recentSession.session_id,
      ts: Date.now(),
      payload: { sessionId: recentSession.session_id },
    }))
  } else {
    // 无历史 session → 提示前端创建
    ws.send(JSON.stringify({
      type: 'agent.updated',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { agent },
    }))
  }
}

export function handleAgentSetDefault(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { agentId: string }
  const existing = dbGetAgent(payload.agentId)
  if (!existing) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'AGENT_NOT_FOUND', message: `Agent not found: ${payload.agentId}`, recoverable: true },
    }))
    return
  }

  const db = getDB()
  // 取消所有默认
  db.prepare('UPDATE agents SET is_default = 0').run()
  // 设置新默认
  db.prepare('UPDATE agents SET is_default = 1 WHERE id = ?').run(payload.agentId)

  ws.send(JSON.stringify({
    type: 'agent.default_changed',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { agentId: payload.agentId },
  }))
  broadcast({ type: 'agent.list', id: `srv-${Date.now()}`, sessionId: '', ts: Date.now(), payload: { agents: dbGetAgents() } })
}
