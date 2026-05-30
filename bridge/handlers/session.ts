import type { WebSocket } from 'ws'
import type { ClientMessage, SessionInfo } from '../protocol'
import {
  createPiSession,
  getPiSession,
  removePiSession,
  getAllSessionMeta,
  getSessionMeta,
  updateSessionMeta,
} from '../pi-session'
import { getDB } from '../db'

// ── session.create（已有，加 SQLite 持久化）────────────────────

export async function handleSessionCreate(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const payload = (msg.payload ?? {}) as { model?: string; thinkingLevel?: 'low' | 'medium' | 'high' }
  const result = await createPiSession({
    modelName: payload.model,
    thinkingLevel: payload.thinkingLevel,
  })

  const db = getDB()
  db.prepare(
    'INSERT OR IGNORE INTO conversations (session_id, title) VALUES (?, ?)',
  ).run(result.sessionId, `新会话 ${new Date().toLocaleDateString('zh-CN')}`)

  ws.send(JSON.stringify({
    type: 'session.created',
    id: `srv-${Date.now()}`,
    sessionId: result.sessionId,
    ts: Date.now(),
    payload: {
      sessionId: result.sessionId,
      model: result.model,
      thinkingLevel: result.thinkingLevel,
      createdAt: Date.now(),
    },
  }))
}

// ── session.list（增强：合并 SQLite + Pi 内存，澪置顶）─────────

function getMainSessionId(): string {
  const row = getDB().prepare("SELECT value FROM settings WHERE key = 'main_session_id'").get() as
    | { value: string }
    | undefined
  return row?.value ?? ''
}

export function handleSessionList(_msg: ClientMessage, ws: WebSocket): void {
  const db = getDB()
  const mainSid = getMainSessionId()

  const dbSessions = db.prepare(`
    SELECT session_id, title, updated_at, created_at FROM conversations ORDER BY updated_at DESC
  `).all() as { session_id: string; title: string; updated_at: string; created_at: string }[]

  const piMetaMap = new Map(getAllSessionMeta().map((m) => [m.id, m]))

  const seen = new Set<string>()
  const list: SessionInfo[] = []

  if (mainSid) {
    const mainMeta = piMetaMap.get(mainSid)
    const mainDb = dbSessions.find((r) => r.session_id === mainSid)
    seen.add(mainSid)
    list.push({
      id: mainSid,
      title: '澪',
      lastActive: mainDb ? new Date(mainDb.updated_at).getTime() : (mainMeta?.createdAt ?? Date.now()),
      roundCount: mainMeta?.roundCount ?? 0,
    })
  }

  for (const [id, meta] of piMetaMap) {
    if (seen.has(id)) continue
    seen.add(id)
    const dbRow = dbSessions.find((r) => r.session_id === id)
    list.push({
      id,
      title: dbRow?.title ?? meta.title,
      lastActive: dbRow ? new Date(dbRow.updated_at).getTime() : meta.createdAt,
      roundCount: meta.roundCount,
    })
  }

  for (const row of dbSessions) {
    if (seen.has(row.session_id)) continue
    seen.add(row.session_id)
    list.push({
      id: row.session_id,
      title: row.title,
      lastActive: new Date(row.updated_at).getTime(),
      roundCount: 0,
    })
  }

  ws.send(JSON.stringify({
    type: 'session.list',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { sessions: list },
  }))
}

// ── session.switch（已有，不变）─────────────────────────────────

export async function handleSessionSwitch(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const payload = msg.payload as { sessionId: string }
  let meta = getSessionMeta(payload.sessionId)

  if (!meta) {
    try {
      await createPiSession({ sessionId: payload.sessionId })
      meta = getSessionMeta(payload.sessionId)
      // 确保 conversations 行存在（懒创建的 session 可能缺行）
      const db = getDB()
      db.prepare('INSERT OR IGNORE INTO conversations (session_id, title) VALUES (?, ?)').run(
        payload.sessionId, `会话 ${new Date().toLocaleDateString('zh-CN')}`,
      )
    } catch (err) {
      console.error('[session] failed to lazily create Pi session:', err)
    }
  }

  const session = getPiSession(payload.sessionId)
  const contextUsage = session?.getContextUsage()

  ws.send(JSON.stringify({
    type: 'session.state',
    id: `srv-${Date.now()}`,
    sessionId: payload.sessionId,
    ts: Date.now(),
    payload: {
      model: meta?.modelName ?? 'deepseek-v3',
      thinkingLevel: meta?.thinkingLevel ?? 'medium',
      contextUsed: contextUsage?.tokens ?? 0,
        contextMax: contextUsage?.contextWindow ?? (session as any).model?.contextWindow ?? 0,
      roundCount: meta?.roundCount ?? 0,
    },
  }))
}

// ── session.history（新增：加载历史消息 + 工具调用）─────────────

export function handleSessionHistory(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { sessionId: string }
  const db = getDB()

  const messages = db.prepare(`
    SELECT m.message_id, m.role, m.content, m.attachments
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.session_id = ?
    ORDER BY m.id ASC
  `).all(payload.sessionId) as { message_id: string; role: string; content: string; attachments: string }[]

  const toolCalls = db.prepare(`
    SELECT tool_call_id, tool_name, input, output, status, duration
    FROM tool_calls
    WHERE session_id = ?
    ORDER BY id ASC
  `).all(payload.sessionId) as {
    tool_call_id: string; tool_name: string; input: string; output: string; status: string; duration: number
  }[]

  ws.send(JSON.stringify({
    type: 'session.history',
    id: `srv-${Date.now()}`,
    sessionId: payload.sessionId,
    ts: Date.now(),
    payload: {
      sessionId: payload.sessionId,
      messages: messages.map((m) => ({
        messageId: m.message_id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        partial: false,
        attachments: m.attachments ? JSON.parse(m.attachments) : undefined,
      })),
      toolCalls: toolCalls.map((t) => ({
        toolCallId: t.tool_call_id,
        toolName: t.tool_name,
        input: t.input ? JSON.parse(t.input) : {},
        output: t.output,
        duration: t.duration,
        status: t.status as 'running' | 'success' | 'error',
      })),
    },
  }))
}

// ── session.rename（新增：更新 SQLite + Pi 内存标题）────────────

export function handleSessionRename(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { sessionId: string; title: string }
  // P3-06: 标题防注入，限制 100 字符，去除 HTML 标签
  const sanitized = payload.title.replace(/<[^>]*>/g, '').slice(0, 100)
  const db = getDB()

  db.prepare('UPDATE conversations SET title = ?, updated_at = datetime(?) WHERE session_id = ?').run(
    sanitized, new Date().toISOString(), payload.sessionId,
  )

  updateSessionMeta(payload.sessionId, { title: payload.title })

  ws.send(JSON.stringify({
    type: 'session.renamed',
    id: `srv-${Date.now()}`,
    sessionId: payload.sessionId,
    ts: Date.now(),
    payload: { sessionId: payload.sessionId, title: payload.title },
  }))
}

// ── session.delete（增强：级联删 SQLite，禁删澪）────────────────

function isMainSession(sessionId: string): boolean {
  return sessionId === getMainSessionId()
}

export function handleSessionDelete(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { sessionId: string }

  if (isMainSession(payload.sessionId)) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: payload.sessionId,
      ts: Date.now(),
      payload: { code: 'MAIN_SESSION_PROTECTED', message: '无法删除主会话「澪」', recoverable: true },
    }))
    return
  }

  const db = getDB()
  db.prepare('DELETE FROM tool_calls WHERE session_id = ?').run(payload.sessionId)
  db.prepare('DELETE FROM conversations WHERE session_id = ?').run(payload.sessionId)

  removePiSession(payload.sessionId)

  ws.send(JSON.stringify({
    type: 'session.deleted',
    id: `srv-${Date.now()}`,
    sessionId: payload.sessionId,
    ts: Date.now(),
    payload: { sessionId: payload.sessionId },
  }))
}

// ── session.compact（P3-01: 手动压缩上下文）───────────────────────

export async function handleSessionCompact(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const session = getPiSession(msg.sessionId)
  if (!session) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'SESSION_NOT_FOUND', message: '会话不存在', recoverable: true },
    }))
    return
  }
  if ((session as any).isStreaming) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'BUSY', message: '会话正在运行，无法压缩', recoverable: true },
    }))
    return
  }

  try {
    const before = session.getContextUsage()
    const beforeTokens = before?.tokens ?? 0
    await (session as any).compact?.()
    const after = session.getContextUsage()
    const afterTokens = after?.tokens ?? 0
    ws.send(JSON.stringify({
      type: 'session.compacted',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: {
        tokensBefore: beforeTokens,
        tokensAfter: afterTokens,
        contextWindow: after?.contextWindow ?? (session as any).model?.contextWindow ?? 0,
      },
    }))
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: {
        code: 'COMPACTION_FAILED',
        message: err instanceof Error ? err.message : '压缩失败',
        recoverable: true,
      },
    }))
  }
}
