/**
 * Renderer — Live2D Desktop Pet (self-contained, no cross-package imports)
 *
 * Loads PIXI + Cubism SDK via <script>, renders Live2D model on canvas.
 * Communicates with MCP adapter via IPC bridge (Main Process ↔ WS Hub).
 *
 * Design: Renderer drives window resize/move and PIXI rendering.
 * Settings are persisted via writeSettings; no settings-changed round-trip.
 */

const statusEl = document.getElementById('status')
const container = document.getElementById('canvas-container')

function setStatus(text) {
  if (statusEl) statusEl.textContent = text
}

// ── Script Loader ───────────────────────────────

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('load fail: ' + src))
    document.head.appendChild(s)
  })
}

// ── Engine State ────────────────────────────────

const state = { app: null, model: null, modelInfo: null, modelPath: null, baseUrl: null }

// ── Init ────────────────────────────────────────

async function initEngine() {
  setStatus('1/4 加载 PixiJS...')
  await loadScript('../vendor/pixi.min.js')

  setStatus('2/4 加载 Cubism Core...')
  await loadScript('../vendor/live2dcubismcore.min.js')

  setStatus('3/4 加载 Cubism4 PIXI...')
  await loadScript('../vendor/cubism4.min.js')

  const P = globalThis.PIXI
  if (!P?.live2d) {
    setStatus('失败: PIXI.live2d 未定义')
    return false
  }

  setStatus('4/4 创建画布...')
  const app = new P.Application({
    width: container.clientWidth,
    height: container.clientHeight,
    backgroundAlpha: 0,
    antialias: true,
  })
  container.appendChild(app.view)
  // Ensure canvas stays behind UI
  app.view.style.position = 'absolute'
  app.view.style.top = '0'
  app.view.style.left = '0'
  app.view.style.zIndex = '1'
  app.view.style.pointerEvents = 'none'
  // RAF-batched resize — prevents PIXI renderer.resize() from being called
  // more than once per frame, eliminating flicker during window resize
  let resizeRAF = null
  new ResizeObserver(() => {
    if (resizeRAF) return
    resizeRAF = requestAnimationFrame(() => {
      resizeRAF = null
      app.renderer.resize(container.clientWidth, container.clientHeight)
      if (state.model) {
        applyModelTransform()
      }
    })
  }).observe(container)
  state.app = app
  setStatus('就绪 — l2d.model.load { path } 加载模型')
  return true
}

// ── Model Load ──────────────────────────────────

async function loadModel(path) {
  if (!state.app) return { ok: false, error: '引擎未初始化' }

  // Unload previous
  if (state.model) {
    state.app.stage.removeChild(state.model)
    state.model.destroy?.()
    state.model = null
  }

  try {
    const P = globalThis.PIXI
    setStatus('加载中: ' + path.split(/[/\\]/).pop())
    // Register model dir with main process → get HTTP base URL
    const baseUrl = await bridge.setModelDir(path)
    state.baseUrl = baseUrl
    const model = await P.live2d.Live2DModel.from(baseUrl, { autoInteract: false })

    model.anchor?.set(0.5, 0.5)
    model.x = state.app.screen.width / 2
    model.y = state.app.screen.height / 2
    const s = Math.min(state.app.screen.width, state.app.screen.height) / 900
    model.scale?.set(s)

    state.app.stage.addChild(model)
    state.model = model
    state.modelPath = path

    // Apply saved model transform
    applyModelTransform()

    // Set up per-frame hook for expressions + frame-based actions
    model.internalModel.on('beforeModelUpdate', () => {
      const cm = model.internalModel.coreModel
      if (!cm || typeof cm.setParameterValueById !== 'function') return

      // Apply expression params
      if (activeParams) {
        for (const p of activeParams) {
          try {
            if (p.blend === 'Add' && typeof cm.addParameterValueById === 'function') {
              cm.addParameterValueById(p.id, p.value, 1)
            } else {
              cm.setParameterValueById(p.id, p.value)
            }
          } catch (_) {}
        }
      }

      // Apply frame-based eye action — persists across frames to work with
      // Cubism update cycle (beforeModelUpdate → EyeBlink → Physics).
      if (eyeAction) {
        const now = performance.now()
        if (now < eyeAction.until) {
          cm.addParameterValueById('ParamEyeLOpen', -1, 1)
        } else {
          eyeAction = null
        }
      }
    })

    // Discover expressions
    const expressions = await discoverExpressions(path)
    state.modelInfo = { model: path.split(/[/\\]/).pop(), expressions }
    setStatus(`已加载: ${state.modelInfo.model} (${expressions.length} 表情)`)

    return { ok: true, model: state.modelInfo.model, expressions }
  } catch (e) {
    setStatus('加载失败')
    return { ok: false, error: e?.message ?? String(e) }
  }
}

async function discoverExpressions(dirPath) {
  try {
    const files = await bridge.readDir(dirPath)
    if (!files || files.length === 0) return []
    const modelJson = files.find(f => f.endsWith('.model3.json'))
    if (!modelJson) return []
    const manifestPath = dirPath.replace(/\\/g, '/') + '/' + modelJson
    const text = await bridge.readFile(manifestPath)
    if (!text) return []
    const m = JSON.parse(text)
    return (m.FileReferences?.Expressions ?? []).map(e => ({
      name: e.Name,
      file: e.File,
      emoji: '',
      description: '',
    }))
  } catch { return [] }
}

// ── Expression ──────────────────────────────────

// Active expression parameters (set by setExpression, applied in beforeModelUpdate).
// Previous params are cancelled before applying new ones because expressions
// use Add/Multiply blend modes that accumulate across frames.
let activeParams = null
let previousParams = null

function setExpression(name) {
  if (!state.model) return { ok: false, error: '未加载模型' }
  const expr = state.modelInfo?.expressions?.find(e => e.name === name)
  const file = expr?.file ?? (name + '.exp3.json')
  const url = (state.baseUrl || 'http://localhost:9229') + '/' + file
  fetch(url)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
    .then(d => {
      // Cancel previous expression params so they don't accumulate
      const cm = state.model?.internalModel?.coreModel
      if (cm && previousParams) {
        for (const p of previousParams) {
          try {
            if (p.blend === 'Multiply') {
              cm.multiplyParameterValueById?.(p.id, 1)  // ×1 = restore
            } else {
              cm.addParameterValueById?.(p.id, -p.value, 1)  // add negation = cancel
            }
          } catch (_) {}
        }
      }
      // Set new params
      const params = (d.Parameters || []).map(p => ({ id: p.Id, value: p.Value, blend: p.Blend || 'Add' }))
      previousParams = params.length > 0 ? params : null
      activeParams = params.length > 0 ? params : null
    })
    .catch(() => { activeParams = null; previousParams = null })
  return { ok: true, name }
}

// Hook: apply expression parameters every frame
// Set up after model is loaded in loadModel function

// ── IPC Bridge ──────────────────────────────────

const bridge = window.l2dPet
if (!bridge) {
  setStatus('IPC 失败')
  throw new Error('l2dPet not available')
}

bridge.onMessage(async (msg) => {
  const { type, payload, _rid } = msg
  console.log('[renderer]', type, payload)

  try {
    // ── Model ──────────────────────────
    if (type === 'l2d.model.load' || type === 'model_load') {
      const path = payload?.path ?? payload
      const result = await loadModel(path)
      bridge.send({ type: 'l2d.model.loaded', payload: result, _rid })
      return
    }

    // ── Expression Set ────────────────
    if (type === 'l2d.expression.set' || type === 'expression') {
      const name = typeof payload === 'string' ? payload : payload?.name
      const result = setExpression(name)
      bridge.send({ type: 'l2d.expression.done', payload: result, _rid })
      return
    }

    // ── Expression List ───────────────
    if (type === 'l2d.expression.list' || type === 'expression_list') {
      const exps = state.modelInfo?.expressions ?? []
      bridge.send({ type: 'l2d.expression.list.result', payload: { expressions: exps }, _rid })
      return
    }

    // ── Action List ───────────────────
    if (type === 'l2d.action.list' || type === 'action_list') {
      // Available semantic actions (all models support these)
      const actions = ['nod', 'shake_head', 'tilt_head', 'wink', 'slow_blink', 'double_blink']
      bridge.send({ type: 'l2d.action.list.result', payload: { actions }, _rid })
      return
    }

    // ── Action Perform ────────────────
    if (type === 'l2d.action.perform') {
      performAction(payload?.name, payload?.intensity, payload?.count)
      bridge.send({ type: 'l2d.action.done', payload: { ok: true, name: payload?.name }, _rid })
      return
    }

    // ── Motion ────────────────────────
    if (type === 'motion') {
      // Forward motion command — renderer doesn't support motion files yet
      console.log('[renderer] motion not yet implemented:', payload?.group, payload?.index)
      bridge.send({ type: 'l2d.motion.done', payload: { ok: true }, _rid })
      return
    }

    // ── Parameter / Animate ───────────
    if (type === 'parameter' || type === 'animate') {
      // Apply parameters directly via Cubism SDK
      applyParameters(payload?.params ?? [])
      bridge.send({ type: 'l2d.param.done', payload: { ok: true }, _rid })
      return
    }

    bridge.send({ type: 'l2d.error', payload: { message: 'unknown: ' + type }, _rid })
  } catch (e) {
    bridge.send({ type: 'l2d.error', payload: { message: String(e) }, _rid })
  }
})

// ── Action Engine ──────────────────────
// Head actions: one-shot addParameterValueById (works because model Physics
// doesn't fight back on ParamAngle*). setTimeout to cancel after duration.
// Eye actions: set persistent override applied every frame in beforeModelUpdate
// (required because EyeBlink system overwrites between-frame changes).
let eyeAction = null  // { until: timestamp } — applies ParamEyeLOpen -1 every frame

function performAction(name, intensity = 1.0, count = 1) {
  if (!state.model) return
  const cm = state.model.internalModel?.coreModel
  if (!cm) return

  switch (name) {
    case 'nod':
      cm.addParameterValueById('ParamAngleY', 30 * intensity, 1)
      setTimeout(() => cm.addParameterValueById('ParamAngleY', -30 * intensity, 1), 300)
      break
    case 'shake_head':
      cm.addParameterValueById('ParamAngleX', 30 * intensity, 1)
      setTimeout(() => cm.addParameterValueById('ParamAngleX', -30 * intensity, 1), 300)
      break
    case 'tilt_head':
      cm.addParameterValueById('ParamAngleZ', 30 * intensity, 1)
      setTimeout(() => cm.addParameterValueById('ParamAngleZ', -30 * intensity, 1), 300)
      break
    case 'wink':
      eyeAction = { until: performance.now() + 150 }
      break
    case 'slow_blink':
      eyeAction = { until: performance.now() + 500 }
      break
    case 'double_blink': {
      const t = performance.now()
      eyeAction = { until: t + 100 }
      setTimeout(() => { eyeAction = { until: t + 200 } }, 110)
      setTimeout(() => { eyeAction = { until: t + 300 } }, 210)
      setTimeout(() => { eyeAction = null }, 310)
      break
    }
  }

  // Repeat
  if (count > 1) {
    setTimeout(() => performAction(name, intensity, count - 1), 400)
  }
}

function applyParameters(params) {
  if (!state.model || !params || !Array.isArray(params)) return
  const cm = state.model.internalModel?.coreModel
  if (!cm || typeof cm.setParameterValueById !== 'function') return
  for (const p of params) {
    if (!p?.id) continue
    try {
      if (p.blend === 'Multiply' && typeof cm.multiplyParameterValueById === 'function') {
        cm.multiplyParameterValueById(p.id, p.value)
      } else if (p.blend === 'Add' && typeof cm.addParameterValueById === 'function') {
        cm.addParameterValueById(p.id, p.value)
      } else {
        cm.setParameterValueById(p.id, p.value)
      }
    } catch (_) {}
  }
}

// ── Settings ────────────────────────────────────

// Cached model settings (forwarded from settings window via main process)
let modelSettings = { scale: 0, offsetX: 0, offsetY: 0 }

const gearBtn = document.getElementById('gear-btn')
gearBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  bridge.openSettings()
})

// Lock toggle
const lockBtn = document.getElementById('lock-btn')
let isLocked = false

async function initLockState() {
  try {
    const s = await bridge.readSettings()
    isLocked = s.window.locked === true
    updateLockUI()
  } catch (e) {
    console.error('[lock] readSettings failed:', e)
  }
}

function updateLockUI() {
  if (isLocked) {
    lockBtn.textContent = '🔒'
    lockBtn.title = '解锁位置'
    lockBtn.classList.add('locked')
  } else {
    lockBtn.textContent = '🔓'
    lockBtn.title = '锁定位置'
    lockBtn.classList.remove('locked')
  }
}

lockBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  isLocked = !isLocked
  bridge.setLocked(isLocked)
  bridge.writeSettings({ 'window.locked': isLocked })
  updateLockUI()
})

// Listen for model settings changes from settings window (via main)
bridge.onModelSettingsChanged((patch) => {
  if (patch['model.scale'] !== undefined) modelSettings.scale = patch['model.scale']
  if (patch['model.offsetX'] !== undefined) modelSettings.offsetX = patch['model.offsetX']
  if (patch['model.offsetY'] !== undefined) modelSettings.offsetY = patch['model.offsetY']
  if (patch['model.visible'] !== undefined && state.model) {
    state.model.visible = patch['model.visible']
  }
  applyModelTransform()
})

function applyModelTransform() {
  if (!state.model || !state.app) return
  const model = state.model
  const rw = state.app.renderer.width
  const rh = state.app.renderer.height
  const s = modelSettings.scale
  const autoScale = Math.min(rw, rh) / 900
  model.scale?.set(s > 0 ? s / 100 : autoScale)
  model.x = rw / 2 + modelSettings.offsetX
  model.y = rh / 2 + modelSettings.offsetY
}

// ── Start ───────────────────────────────────────

bridge.send({ type: 'l2d.system.ready.signal' })
initEngine().catch(err => {
  console.error('[renderer] engine init failed:', err)
  setStatus('✗ ' + String(err).slice(0, 80))
})
initLockState()
