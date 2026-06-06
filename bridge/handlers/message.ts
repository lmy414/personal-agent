import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { getPiSession, updateSessionMeta, getSessionMeta, createPiSession, getSafeContextWindow } from '../pi-session'
import { getDB } from '../db'
import { isMainSession } from './session'

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
  }
  return JSON.stringify(content)
}

async function generateSessionTitle(sessionId: string): Promise<string | null> {
  try {
    const db = getDB()
    const msgs = db.prepare(`
      SELECT m.role, m.content
      FROM messages m JOIN conversations c ON m.conversation_id = c.id
      WHERE c.session_id = ?
      ORDER BY m.id ASC
    `).all(sessionId) as { role: string; content: string }[]

    if (msgs.length < 2) {
      return null
    }

    const userMsg = msgs.find((m) => m.role === 'user' && m.content)?.content?.slice(0, 200) ?? ''
    const aiMsg = msgs.find((m) => m.role === 'assistant' && m.content)?.content?.slice(0, 200) ?? ''
    if (!userMsg || !aiMsg) {
      return null
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      console.log('[auto-name] DEEPSEEK_API_KEY not set')
      return null
    }

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '用3-5个汉字总结这段对话的主题。只输出主题本身，不要解释，不要标点。' },
          { role: 'user', content: `用户: ${userMsg}\n\n助手: ${aiMsg}\n\n用3-5个汉字总结主题:` },
        ],
        max_tokens: 15,
        temperature: 0.3,
      }),
    })

    const data = await resp.json() as any
    const title = data.choices?.[0]?.message?.content?.trim()
    if (title) {
      // title generated successfully
    } else {
      console.log('[auto-name] DeepSeek returned no title:', JSON.stringify(data).slice(0, 200))
    }
    return title?.slice(0, 20) ?? null
  } catch (err) {
    console.error('[auto-name] failed:', err)
    return null
  }
}

export async function handleMessageSend(msg: ClientMessage, ws: WebSocket): Promise<void> {
  let session = getPiSession(msg.sessionId)

  // 懒加载：主会话澪等首次发消息时创建 Pi session
  if (!session) {
    try {
      await createPiSession({ sessionId: msg.sessionId })
      session = getPiSession(msg.sessionId)
      // 确保 conversations 行存在
      const db = getDB()
      db.prepare('INSERT OR IGNORE INTO conversations (session_id, title) VALUES (?, ?)').run(
        msg.sessionId, `会话 ${new Date().toLocaleDateString('zh-CN')}`,
      )
    } catch (err) {
      console.error('[message] failed to lazily create Pi session:', err)
    }
  }

  if (!session) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'SESSION_NOT_FOUND', message: `Session not found: ${msg.sessionId}`, recoverable: true },
    }))
    return
  }

  if (session.isStreaming) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'ALREADY_STREAMING', message: 'A turn is already in progress', recoverable: true },
    }))
    return
  }

  const payload = msg.payload as { content: string; displayContent?: string; attachments?: { path: string; name: string; isImage: boolean }[] }

  // 持久化用户消息到 SQLite（displayContent 用于展示，不含文件内容）
  try {
    const db = getDB()
    const conv = db.prepare('SELECT id FROM conversations WHERE session_id = ?').get(msg.sessionId) as { id: number } | undefined
    if (conv) {
      const attsJson = payload.attachments?.length ? JSON.stringify(payload.attachments) : ''
      const displayText = payload.displayContent || payload.content
      db.prepare(
        'INSERT INTO messages (conversation_id, message_id, role, content, attachments) VALUES (?, ?, ?, ?, ?)',
      ).run(conv.id, `msg-user-${Date.now()}`, 'user', displayText, attsJson)
    }
  } catch (e) {
    console.warn('[message] failed to persist user message:', e)
  }

  let turnIndex = 0
  let messageId = ''
  let lastUsage: { input: number; output: number; total: number; cost: number } | undefined
  const toolStartTimes = new Map<string, number>()

  const unsubscribe = session.subscribe((event: any) => {
    switch (event.type) {
      case 'turn_start': {
        turnIndex = Date.now()
        ws.send(JSON.stringify({
          type: 'turn.start',
          id: `srv-${Date.now()}`,
          sessionId: msg.sessionId,
          ts: Date.now(),
          payload: { turnIndex },
        }))
        break
      }

      case 'message_start': {
        if (event.message?.role === 'assistant') {
          messageId = `msg-${Date.now()}`
          ws.send(JSON.stringify({
            type: 'message.start',
            id: `srv-${Date.now()}`,
            sessionId: msg.sessionId,
            ts: Date.now(),
            payload: { messageId, role: 'assistant' },
          }))
        }
        break
      }

      case 'message_update': {
        const ame = event.assistantMessageEvent
        if (!ame) break
        if (ame.type === 'text_delta' || ame.type === 'thinking_delta') {
          ws.send(JSON.stringify({
            type: 'message.delta',
            id: `srv-${Date.now()}`,
            sessionId: msg.sessionId,
            ts: Date.now(),
            payload: {
              messageId,
              delta: ame.delta,
              deltaType: ame.type === 'thinking_delta' ? 'thinking' : 'text',
            },
          }))
        }
        break
      }

      case 'message_end': {
        const message = event.message
        if (message?.role === 'assistant') {
          const usage = message.usage
          if (usage) {
            lastUsage = {
              input: usage.input,
              output: usage.output,
              total: usage.totalTokens,
              cost: usage.cost?.total ?? 0,
            }
          }
          ws.send(JSON.stringify({
            type: 'message.end',
            id: `srv-${Date.now()}`,
            sessionId: msg.sessionId,
            ts: Date.now(),
            payload: {
              messageId,
              content: extractTextContent(message.content),
              usage: usage
                ? { input: usage.input, output: usage.output, total: usage.totalTokens }
                : { input: 0, output: 0, total: 0 },
            },
          }))

          // 持久化 assistant 消息到 SQLite
          try {
            const db = getDB()
            const conv = db.prepare('SELECT id FROM conversations WHERE session_id = ?').get(msg.sessionId) as { id: number } | undefined
            if (conv) {
              db.prepare(
                'INSERT INTO messages (conversation_id, message_id, role, content, tokens_input, tokens_output) VALUES (?, ?, ?, ?, ?, ?)',
              ).run(conv.id, messageId, 'assistant', extractTextContent(message.content), usage?.input ?? 0, usage?.output ?? 0)
            }
          } catch (e) {
            console.warn('[message] failed to persist assistant message:', e)
          }
        }
        break
      }

      case 'tool_execution_start': {
        toolStartTimes.set(event.toolCallId, Date.now())
        ws.send(JSON.stringify({
          type: 'tool.start',
          id: `srv-${Date.now()}`,
          sessionId: msg.sessionId,
          ts: Date.now(),
          payload: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.args ?? {},
          },
        }))

        // 持久化 tool_call start
        try {
          const db = getDB()
          db.prepare(
            'INSERT INTO tool_calls (session_id, tool_call_id, tool_name, input, status) VALUES (?, ?, ?, ?, ?)',
          ).run(msg.sessionId, event.toolCallId, event.toolName, JSON.stringify(event.args ?? {}), 'running')
        } catch (e) {
          console.warn('[message] failed to persist tool start:', e)
        }
        break
      }

      case 'tool_execution_update': {
        ws.send(JSON.stringify({
          type: 'tool.progress',
          id: `srv-${Date.now()}`,
          sessionId: msg.sessionId,
          ts: Date.now(),
          payload: {
            toolCallId: event.toolCallId,
            output: typeof event.partialResult === 'string'
              ? event.partialResult
              : JSON.stringify(event.partialResult),
          },
        }))
        break
      }

      case 'tool_execution_end': {
        const startTime = toolStartTimes.get(event.toolCallId)
        const duration = startTime ? Date.now() - startTime : 0
        toolStartTimes.delete(event.toolCallId)
        ws.send(JSON.stringify({
          type: 'tool.end',
          id: `srv-${Date.now()}`,
          sessionId: msg.sessionId,
          ts: Date.now(),
          payload: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            output: typeof event.result === 'string' ? event.result : JSON.stringify(event.result),
            duration,
            status: event.isError ? 'error' : 'success',
          },
        }))

        // 更新 tool_call end
        try {
          const db = getDB()
          db.prepare(
            'UPDATE tool_calls SET output = ?, status = ?, duration = ? WHERE tool_call_id = ?',
          ).run(
            typeof event.result === 'string' ? event.result : JSON.stringify(event.result),
            event.isError ? 'error' : 'success',
            duration,
            event.toolCallId,
          )
        } catch (e) {
          console.warn('[message] failed to persist tool end:', e)
        }
        break
      }

      case 'agent_end': {
        unsubscribe()
        ws.send(JSON.stringify({
          type: 'turn.end',
          id: `srv-${Date.now()}`,
          sessionId: msg.sessionId,
          ts: Date.now(),
          payload: {
            turnIndex,
            usage: lastUsage
              ? { input: lastUsage.input, output: lastUsage.output, total: lastUsage.total }
              : { input: 0, output: 0, total: 0 },
            cost: lastUsage?.cost ?? 0,
          },
        }))

        const meta = getSessionMeta(msg.sessionId)
        const newRoundCount = (meta?.roundCount ?? 0) + 1
        if (meta) {
          updateSessionMeta(msg.sessionId, { roundCount: newRoundCount })
        }

        // P1: 检查 context 使用率，超阈值自动 compact
        try {
          const db = getDB()
          const thrRow = db.prepare("SELECT value FROM settings WHERE key = 'compact_threshold'").get() as { value: string } | undefined
          const threshold = thrRow?.value ? parseInt(thrRow.value, 10) : 80
          let ctx = null as any
          try { ctx = session.getContextUsage() } catch { /* activeRun 可能已清理 */ }
          const ctxTokens = ctx?.tokens ?? 0
          const ctxWindow = ctx?.contextWindow ?? 0
          if (ctxTokens > 0 && ctxWindow > 0) {
            const pct = Math.round((ctxTokens / ctxWindow) * 100)
            if (pct >= threshold) {
              if (typeof (session as any).compact === 'function' && !(session as any).isStreaming) {
                const before = ctxTokens
                ;(session as any).compact().then((result: any) => {
                  let afterTokens = 0
                  try { afterTokens = session.getContextUsage()?.tokens ?? 0 } catch { /* 忽略 */ }
                  const saved = result?.tokensBefore ?? before - afterTokens
                  ws.send(JSON.stringify({
                    type: 'session.compacted',
                    id: `srv-${Date.now()}`,
                    sessionId: msg.sessionId,
                    ts: Date.now(),
                    payload: {
                      tokensBefore: before,
                      tokensAfter: afterTokens,
                      tokensSaved: Math.max(0, saved),
                      contextWindow: ctxWindow,
                    },
                  }))
                }).catch(() => { /* 自动 compact 失败不阻塞 */ })
              }
            }
          }
        } catch {
          // compact_threshold 读取失败不阻塞
        }

        // 首轮完成后 AI 自动命名（跳过主会话澪）
        const isMain = isMainSession(msg.sessionId)
        const shouldName = newRoundCount === 1 && !isMain
        if (shouldName) {
          generateSessionTitle(msg.sessionId).then((title) => {
            if (title) {
              const db = getDB()
              const dateStr = new Date().toLocaleDateString('zh-CN')
              const fullTitle = `${title} ${dateStr}`
              db.prepare('UPDATE conversations SET title = ?, updated_at = datetime(?) WHERE session_id = ?').run(
                fullTitle, new Date().toISOString(), msg.sessionId,
              )
              updateSessionMeta(msg.sessionId, { title: fullTitle })
              ws.send(JSON.stringify({
                type: 'session.renamed',
                id: `srv-${Date.now()}`,
                sessionId: msg.sessionId,
                ts: Date.now(),
                payload: { sessionId: msg.sessionId, title: fullTitle },
              }))
            }
          })
        }

        // Update conversation updated_at
        try {
          const db = getDB()
          db.prepare('UPDATE conversations SET updated_at = datetime(?) WHERE session_id = ?').run(
            new Date().toISOString(), msg.sessionId,
          )
        } catch (e) {
          console.warn('[message] failed to update conversation timestamp:', e)
        }

        try {
          const stats = session.getSessionStats()
          const ctx = session.getContextUsage()
          // P1-05: contextMax 从 model.contextWindow 动态获取
          const contextMax = getSafeContextWindow(msg.sessionId)
          ws.send(JSON.stringify({
            type: 'status.update',
            id: `srv-${Date.now()}`,
            sessionId: msg.sessionId,
            ts: Date.now(),
            payload: {
              tokens: stats.tokens.total,
              cost: stats.cost,
              contextUsed: ctx?.tokens ?? 0,
              contextMax,
              roundCount: newRoundCount,
              model: (session as any).model?.id ?? '',
            },
          }))

          // P3-02: 写入 context_log 持久化上下文用量
          try {
            const db = getDB()
            const ctx = session.getContextUsage()
            if (ctx) {
              db.prepare(
                'INSERT INTO context_log (session_id, used_tokens, context_window, percent, model_id) VALUES (?, ?, ?, ?, ?)',
              ).run(
                msg.sessionId,
                ctx.tokens ?? 0,
                contextMax,
                ctx.percent ?? 0,
                (session as any).model?.id ?? '',
              )
            }
          } catch {
            // context_log is non-critical
          }
        } catch {
          // getSessionStats may throw if no session file is configured
        }
        break
      }
    }
  })

  try {
    await session.prompt(payload.content)
  } catch (err) {
    // 确保流式状态被清理，防止后续消息全部被 ALREADY_STREAMING 拒绝
    try { await session.abort() } catch { /* best-effort */ }
    unsubscribe()
    console.error(`[message] prompt failed for session ${msg.sessionId}:`, err)
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: {
        code: 'PROMPT_FAILED',
        message: err instanceof Error ? err.message : 'Failed to send message',
        recoverable: true,
      },
    }))
  }
}

export async function handleMessageCancel(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const session = getPiSession(msg.sessionId)
  if (!session) return
  try {
    await session.abort()
  } catch (err) {
    console.warn('[message] abort error:', err)
  }
  // 确认中断完成，推动状态同步
  const ctx = session.getContextUsage()
  const stats = (session as any).getSessionStats?.()
  const meta = getSessionMeta(msg.sessionId)
  ws.send(JSON.stringify({
    type: 'turn.end',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: {
      turnIndex: Date.now(),
      usage: { input: stats?.tokens?.input ?? 0, output: stats?.tokens?.output ?? 0, total: stats?.tokens?.total ?? 0 },
      cost: stats?.cost ?? 0,
    },
  }))
  ws.send(JSON.stringify({
    type: 'status.update',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: {
      tokens: stats?.tokens?.total ?? 0,
      cost: stats?.cost ?? 0,
      contextUsed: ctx?.tokens ?? 0,
      contextMax: ctx?.contextWindow ?? (session as any).model?.contextWindow ?? meta?.contextWindow ?? 0,
      roundCount: meta?.roundCount ?? 0,
      model: (session as any).model?.id ?? '',
    },
  }))
}
