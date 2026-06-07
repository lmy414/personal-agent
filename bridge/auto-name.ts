import { getDB } from './db'

/**
 * AI 自动命名 — 调用 DeepSeek API 生成会话标题（3-5 汉字）
 *
 * 仅在新会话首轮完成后调用，跳过主会话「澪」。
 * 失败静默降级：API 不可用时不阻塞业务流程。
 */
export async function generateSessionTitle(sessionId: string): Promise<string | null> {
  try {
    const db = getDB()
    const msgs = db.prepare(`
      SELECT m.role, m.content
      FROM messages m JOIN conversations c ON m.conversation_id = c.id
      WHERE c.session_id = ?
      ORDER BY m.id ASC
    `).all(sessionId) as { role: string; content: string }[]

    if (msgs.length < 2) return null

    const userMsg = msgs.find((m) => m.role === 'user' && m.content)?.content?.slice(0, 200) ?? ''
    const aiMsg = msgs.find((m) => m.role === 'assistant' && m.content)?.content?.slice(0, 200) ?? ''
    if (!userMsg || !aiMsg) return null

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
    if (!title) {
      console.log('[auto-name] DeepSeek returned no title:', JSON.stringify(data).slice(0, 200))
    }
    return title?.slice(0, 20) ?? null
  } catch (err) {
    console.error('[auto-name] failed:', err)
    return null
  }
}
