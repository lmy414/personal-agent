import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { getPiSession, resolveModel, getAvailableModels, getSessionMeta, updateSessionMeta, getSafeContextWindow } from '../pi-session'

export async function handleModelSwitch(msg: ClientMessage, ws: WebSocket): Promise<void> {
  const payload = msg.payload as { modelId: string }
  const session = getPiSession(msg.sessionId)
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

  // P1-04: 对话中禁止切换模型
  if ((session as any).isStreaming) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'BUSY', message: '会话正在运行，无法切换模型', recoverable: true },
    }))
    return
  }

  const previousModelId = session.model?.id
  try {
    const model = resolveModel(msg.sessionId, payload.modelId)
    await session.setModel(model)
    // 更新 meta 中的 contextWindow
    const newCw = (model as any).contextWindow ?? 0
    if (newCw > 0) {
      updateSessionMeta(msg.sessionId, { contextWindow: newCw, modelName: payload.modelId })
    }
  } catch (err) {
    console.warn(`[model] failed to switch model:`, err)
  }

  // 广播 state.model 变更
  ws.send(JSON.stringify({
    type: 'state.model',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: {
      modelId: payload.modelId,
      provider: (session.model as any)?.provider ?? '',
      previousModelId,
    },
  }))

  // P1-04: 返回真实数据
  const ctx = session.getContextUsage()
  const meta = getSessionMeta(msg.sessionId)
  ws.send(JSON.stringify({
    type: 'session.state',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: {
      model: session.model?.id ?? payload.modelId,
      thinkingLevel: meta?.thinkingLevel ?? 'medium',
      contextUsed: ctx?.tokens ?? 0,
      contextMax: getSafeContextWindow(msg.sessionId),
      roundCount: meta?.roundCount ?? 0,
    },
  }))
}

export function handleModelList(msg: ClientMessage, ws: WebSocket): void {
  const session = getPiSession(msg.sessionId)
  const models = getAvailableModels(session?.modelRegistry)
  const ctx = session?.getContextUsage()
  const meta = getSessionMeta(msg.sessionId)
  const stats = session?.getSessionStats()

  ws.send(JSON.stringify({
    type: 'status.update',
    id: `srv-${Date.now()}`,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: {
      tokens: stats?.tokens?.total ?? 0,
      cost: stats?.cost ?? 0,
      contextUsed: ctx?.tokens ?? 0,
      contextMax: getSafeContextWindow(msg.sessionId),
      roundCount: meta?.roundCount ?? 0,
      model: session?.model?.id,
      availableModels: models,
    },
  }))
}
