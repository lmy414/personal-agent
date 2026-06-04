/**
 * Core Engine — PIXI + Cubism SDK coordinator.
 *
 * Runs in Electron renderer (Chromium).
 * Assumes live2dcubismcore.min.js is loaded via <script> before this module.
 */

import type { ModelInfo, ExpressionDef } from '../../protocol/src/types'
import { BUILTIN_ACTIONS, type BuiltinAction } from '../../protocol/src/types'

// PIXI + Cubism are loaded at runtime via <script> tags.
// We access them through globalThis.PIXI to avoid bundling issues.
type PIXIApp = any
type Live2DModel = any

export interface EngineState {
  app: PIXIApp | null
  model: Live2DModel | null
  modelInfo: ModelInfo | null
  modelPath: string | null
}

export interface EngineOptions {
  /** Canvas container element */
  container: HTMLElement
  /** Initial size */
  width: number
  height: number
  /** Path to live2dcubismcore.min.js (for runtime loading) */
  coreScript?: string
  /** Path to Cubism 4 PIXI bridge script (pixi-live2d-display bundle) */
  bridgeScript?: string
}

export function createEngine(): EngineState {
  return {
    app: null,
    model: null,
    modelInfo: null,
    modelPath: null,
  }
}

/**
 * Load external scripts sequentially.
 * live2dcubismcore.min.js MUST be loaded before pixi-live2d-display.
 */
async function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`failed to load: ${src}`))
    document.head.appendChild(s)
  })
}

/**
 * Initialize PIXI + Cubism SDK.
 * Call once when the renderer starts.
 */
export async function initEngine(
  state: EngineState,
  options: EngineOptions,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Load Cubism Core (proprietary — must be provided by user)
    if (options.coreScript) {
      await loadScript(options.coreScript)
    }

    // 2. Load pixi-live2d-display (community Cubism-PIXI bridge)
    if (options.bridgeScript) {
      await loadScript(options.bridgeScript)
    }

    // 3. Access PIXI (from window.PIXI — pixi.js loaded via <script> or import)
    const P = (globalThis as any).PIXI
    if (!P) {
      return { ok: false, error: 'PIXI not found — ensure pixi.js is loaded' }
    }
    if (!P.live2d) {
      return { ok: false, error: 'PIXI.live2d not found — ensure pixi-live2d-display is loaded after live2dcubismcore' }
    }

    // 4. Create PIXI Application
    const app = new P.Application({
      resizeTo: options.container,
      backgroundAlpha: 0,
      antialias: true,
    })
    options.container.appendChild(app.view as HTMLCanvasElement)
    state.app = app

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

/**
 * Load a Live2D model from the given directory path.
 * Path must contain .model3.json.
 */
export async function loadModel(
  state: EngineState,
  path: string,
): Promise<{ ok: boolean; model?: string; error?: string }> {
  if (!state.app) {
    return { ok: false, error: 'Engine not initialized — call initEngine first' }
  }

  try {
    // Unload previous model
    if (state.model) {
      state.app.stage.removeChild(state.model)
      state.model.destroy?.()
      state.model = null
    }

    const P = (globalThis as any).PIXI
    const modelUrl = `${path}/model3.json` // pixi-live2d-display loads from .model3.json
    const model: Live2DModel = await P.live2d.Live2DModel.from(modelUrl, { autoInteract: false })

    // Center and scale
    model.anchor?.set(0.5, 0.5)
    model.x = state.app.screen.width / 2
    model.y = state.app.screen.height / 2
    const scale = Math.min(state.app.screen.width, state.app.screen.height) / 900
    model.scale?.set(scale)

    state.app.stage.addChild(model)
    state.model = model
    state.modelPath = path

    // Discover model capabilities
    const info = await discoverModel(path)
    state.modelInfo = info

    return { ok: true, model: info.model }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

/**
 * Discover model capabilities from .model3.json and its referenced files.
 * This is the same logic the protocol layer expects — reads file structure,
 * extracts expression list, parameter list, and available actions.
 */
export async function discoverModel(path: string): Promise<ModelInfo> {
  const name = path.split(/[/\\]/).filter(Boolean).pop() ?? path

  // Fetch .model3.json
  const manifestRes = await fetch(`${path}/model3.json`)
  const expressions: ExpressionDef[] = []

  if (manifestRes.ok) {
    const manifest = await manifestRes.json()
    const exprList = manifest.FileReferences?.Expressions ?? []
    for (const entry of exprList) {
      let emoji = ''
      let desc = ''
      const filePath = entry.File as string
      if (filePath) {
        try {
          const exprRes = await fetch(`${path}/${filePath}`)
          if (exprRes.ok) {
            const exprData = await exprRes.json()
            const params = exprData.Parameters ?? []
            // Build description from the first parameter
            if (params.length > 0) {
              desc = `${params.length} 参数, Blend=${params[0].Blend ?? 'Add'}`
            }
          }
        } catch { /* skip individual expression load errors */ }
      }
      expressions.push({ name: entry.Name as string, emoji, description: desc })
    }
  }

  return {
    model: name,
    expressions,
    actions: [...BUILTIN_ACTIONS],
    parameters: [
      'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',
      'ParamEyeLOpen', 'ParamEyeROpen',
      'ParamEyeBallX', 'ParamEyeBallY',
      'ParamBrowLY', 'ParamBrowRY',
      'ParamMouthOpenY', 'ParamMouthForm',
      'ParamBodyAngleX', 'ParamBreath',
      'ParamHairFront', 'ParamHairSide', 'ParamHairBack',
    ],
  }
}

/**
 * Set expression on the current model.
 * Uses pixi-live2d-display's expression API.
 */
export function setExpression(
  state: EngineState,
  name: string,
): { ok: boolean; error?: string } {
  if (!state.model) {
    return { ok: false, error: 'No model loaded' }
  }
  try {
    const internalModel = state.model.internalModel
    const motionManager = internalModel?.expressionManager
    if (motionManager) {
      // Use pixi-live2d-display expression manager
      internalModel.expressionManager?.startExpression?.(name)
    } else {
      // Fallback: manual expression via internalModel
      const expressions = internalModel?.getExpressionList?.() ?? []
      const expr = expressions.find((e: any) => e.name === name || e.getName?.() === name)
      if (expr) {
        internalModel.setExpression?.(expr)
      } else {
        return { ok: false, error: `Expression not found: ${name}` }
      }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

/**
 * Perform a built-in semantic action (nod, wink, etc.).
 * Implemented as parameter keyframe sequences via beforeModelUpdate.
 */
export function performAction(
  state: EngineState,
  name: string,
  _intensity: number = 1,
): { ok: boolean; error?: string } {
  if (!state.model) {
    return { ok: false, error: 'No model loaded' }
  }
  if (!BUILTIN_ACTIONS.includes(name as BuiltinAction)) {
    return { ok: false, error: `Unknown action: ${name}` }
  }
  // Delegate to action engine
  return executeBuiltinAction(state.model.internalModel, name as BuiltinAction)
}

// ── Built-in Actions ──────────────────────────────────

const ACTION_SEQUENCES: Record<BuiltinAction, Array<{ id: string; value: number; duration: number }>> = {
  nod: [
    { id: 'ParamAngleX', value: -12, duration: 250 },
    { id: 'ParamAngleX', value: 0, duration: 250 },
    { id: 'ParamAngleX', value: -8, duration: 200 },
    { id: 'ParamAngleX', value: 0, duration: 200 },
  ],
  shake_head: [
    { id: 'ParamAngleY', value: -12, duration: 200 },
    { id: 'ParamAngleY', value: 12, duration: 200 },
    { id: 'ParamAngleY', value: -8, duration: 200 },
    { id: 'ParamAngleY', value: 8, duration: 150 },
    { id: 'ParamAngleY', value: 0, duration: 150 },
  ],
  tilt_head: [
    { id: 'ParamAngleZ', value: -18, duration: 300 },
    { id: 'ParamAngleZ', value: 0, duration: 300 },
  ],
  wink: [
    { id: 'ParamEyeLOpen', value: 0, duration: 120 },
    { id: 'ParamEyeLOpen', value: 1, duration: 120 },
  ],
  slow_blink: [
    { id: 'ParamEyeLOpen', value: 0, duration: 400 },
    { id: 'ParamEyeROpen', value: 0, duration: 400 },
    { id: 'ParamEyeLOpen', value: 1, duration: 400 },
    { id: 'ParamEyeROpen', value: 1, duration: 400 },
  ],
  double_blink: [
    { id: 'ParamEyeLOpen', value: 0, duration: 80 },
    { id: 'ParamEyeROpen', value: 0, duration: 80 },
    { id: 'ParamEyeLOpen', value: 1, duration: 80 },
    { id: 'ParamEyeROpen', value: 1, duration: 80 },
    { id: 'ParamEyeLOpen', value: 0, duration: 80 },
    { id: 'ParamEyeROpen', value: 0, duration: 80 },
    { id: 'ParamEyeLOpen', value: 1, duration: 80 },
    { id: 'ParamEyeROpen', value: 1, duration: 80 },
  ],
}

function executeBuiltinAction(internalModel: any, name: BuiltinAction): { ok: boolean; error?: string } {
  const seq = ACTION_SEQUENCES[name]
  const cm = internalModel?.coreModel
  if (!cm || typeof cm.setParameterValueById !== 'function') {
    return { ok: false, error: 'Core model not available' }
  }
  let delay = 0
  for (const step of seq) {
    setTimeout(() => {
      try { cm.setParameterValueById(step.id, step.value) } catch { /* ignore */ }
    }, delay)
    delay += step.duration
  }
  return { ok: true }
}
