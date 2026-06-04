/**
 * WS Hub — command handlers + model state.
 * Stub implementations until Core (PIXI + Cubism) is integrated.
 */

import type { ModelInfo, ExpressionSetPayload, ActionPerformPayload } from '../../protocol/src/types'
import { BUILTIN_ACTIONS } from '../../protocol/src/types'

export interface HubState {
  modelInfo: ModelInfo | null
  modelPath: string | null
}

export function createState(): HubState {
  return { modelInfo: null, modelPath: null }
}

interface WsRequest {
  type: string
  payload: unknown
  _rid: number
}

export async function handleMessage(
  msg: WsRequest,
  state: HubState,
): Promise<{ type: string; payload: unknown; _rid: number }> {
  const { type, payload, _rid } = msg

  switch (type) {

    case 'l2d.model.load': {
      const p = payload as { path: string }
      // TODO Phase 2: actually load model via Core
      state.modelPath = p.path
      const name = p.path.split(/[/\\]/).filter(Boolean).pop() ?? p.path
      state.modelInfo = {
        model: name,
        expressions: [
          { name: 'kongbai', description: '空白 — 默认无表情', emoji: '' },
          { name: 'aixinyan', emoji: '🥰', description: '爱心眼 — 喜欢、心动' },
          { name: 'xingxingyan', emoji: '🤩', description: '星星眼 — 兴奋、期待' },
          { name: 'lianhong', emoji: '😳', description: '脸红 — 害羞' },
          { name: 'duzui', emoji: '😗', description: '嘟嘴 — 撒娇' },
          { name: 'guzui', emoji: '😤', description: '鼓嘴 — 憋话' },
        ],
        actions: [...BUILTIN_ACTIONS],
        parameters: [
          'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',
          'ParamEyeLOpen', 'ParamEyeROpen',
          'ParamMouthOpenY', 'ParamBreath',
        ],
      }
      return { type: 'l2d.model.loaded', payload: { ok: true, model: name }, _rid }
    }

    case 'l2d.expression.set': {
      const p = payload as ExpressionSetPayload
      if (!state.modelInfo) {
        return { type: 'l2d.expression.done', payload: { name: p.name, ok: false, error: 'model not loaded' }, _rid }
      }
      // TODO Phase 2: call Core
      return { type: 'l2d.expression.done', payload: { name: p.name, ok: true }, _rid }
    }

    case 'l2d.expression.list': {
      if (!state.modelInfo) {
        return { type: 'l2d.expression.list', payload: { expressions: [] }, _rid }
      }
      return { type: 'l2d.expression.list', payload: { expressions: state.modelInfo.expressions }, _rid }
    }

    case 'l2d.action.perform': {
      const p = payload as ActionPerformPayload
      if (!state.modelInfo) {
        return { type: 'l2d.action.done', payload: { name: p.name, ok: false, error: 'model not loaded' }, _rid }
      }
      if (!BUILTIN_ACTIONS.includes(p.name as typeof BUILTIN_ACTIONS[number])) {
        return { type: 'l2d.action.done', payload: { name: p.name, ok: false, error: `unknown action: ${p.name}` }, _rid }
      }
      // TODO Phase 2: call Core
      return { type: 'l2d.action.done', payload: { name: p.name, ok: true }, _rid }
    }

    case 'l2d.action.list': {
      if (!state.modelInfo) {
        return { type: 'l2d.action.list', payload: { actions: [] }, _rid }
      }
      return { type: 'l2d.action.list', payload: { actions: state.modelInfo.actions }, _rid }
    }

    default:
      return { type: 'l2d.error', payload: { message: `unknown type: ${type}` }, _rid }
  }
}
