/**
 * Settings Window — Live2D Desktop Pet
 *
 * Independent window for adjusting window size, opacity, and model transform.
 * Communicates with main process via IPC; main forwards model changes to renderer.
 */

const bridge = window.l2dPetSettings
if (!bridge) {
  throw new Error('l2dPetSettings not available')
}

// Sync sliders ↔ number inputs
function bindSliderNum(sliderId, numId, valId, onApply, fmt) {
  const slider = document.getElementById(sliderId)
  const num = document.getElementById(numId)
  const val = document.getElementById(valId)
  if (!slider || !num) return
  function update(v) {
    slider.value = v; num.value = v
    if (val) val.textContent = fmt ? fmt(v) : v
  }
  slider.addEventListener('input', () => { update(slider.value); if (onApply) onApply(Number(slider.value)) })
  num.addEventListener('change', () => { update(num.value); if (onApply) onApply(Number(num.value)) })
  return update
}

function debounce(fn, ms) {
  let timer = null
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), ms)
  }
}

async function init() {
  let s
  try {
    s = await bridge.readSettings()
  } catch (e) {
    console.error('[settings] readSettings failed:', e)
    return
  }

  // Local mutable state for toggle buttons (s is initial read-only)
  let modelVisible = s.model?.visible !== false

  // ── Window size ──
  const updateWidth = bindSliderNum('set-width', 'set-width-num', 'val-width', debounce((v) => {
    const h = Number(document.getElementById('set-height').value) || s.window.height
    bridge.resizeWindow(v, h)
    bridge.writeSettings({ 'window.width': v, 'window.height': h })
  }, 60), v => v + 'px')
  if (updateWidth) updateWidth(s.window.width)

  const updateHeight = bindSliderNum('set-height', 'set-height-num', 'val-height', debounce((v) => {
    const w = Number(document.getElementById('set-width').value) || s.window.width
    bridge.resizeWindow(w, v)
    bridge.writeSettings({ 'window.width': w, 'window.height': v })
  }, 60), v => v + 'px')
  if (updateHeight) updateHeight(s.window.height)

  // ── Opacity ──
  const updateOpacity = bindSliderNum('set-opacity', 'set-opacity', 'val-opacity', debounce((v) => {
    bridge.setOpacity(v / 100)
    bridge.writeSettings({ 'window.opacity': v / 100 })
  }, 60), v => (v / 100).toFixed(1))
  if (updateOpacity) updateOpacity(Math.round(s.window.opacity * 100))

  // ── Model transform ──
  const updateScale = bindSliderNum('set-scale', 'set-scale-num', 'val-scale', debounce((v) => {
    bridge.writeSettings({ 'model.scale': v })
  }, 60), v => v === 0 ? '自动' : (v / 100).toFixed(2))
  if (updateScale) updateScale(s.model.scale)

  const updateOffX = bindSliderNum('set-offx', 'set-offx-num', 'val-offx', debounce((v) => {
    bridge.writeSettings({ 'model.offsetX': v })
  }, 60), v => v + 'px')
  if (updateOffX) updateOffX(s.model.offsetX)

  const updateOffY = bindSliderNum('set-offy', 'set-offy-num', 'val-offy', debounce((v) => {
    bridge.writeSettings({ 'model.offsetY': v })
  }, 60), v => v + 'px')
  if (updateOffY) updateOffY(s.model.offsetY)

  // Buttons
  document.getElementById('btn-reset').addEventListener('click', () => {
    bridge.writeSettings({ 'model.offsetX': 0, 'model.offsetY': 0, 'model.scale': 0 })
    document.getElementById('set-offx').value = 0
    document.getElementById('set-offx-num').value = 0
    document.getElementById('set-offy').value = 0
    document.getElementById('set-offy-num').value = 0
    document.getElementById('set-scale').value = 0
    document.getElementById('set-scale-num').value = 0
  })

  document.getElementById('btn-hide').addEventListener('click', () => {
    modelVisible = !modelVisible
    bridge.writeSettings({ 'model.visible': modelVisible })
    document.getElementById('btn-hide').textContent = modelVisible ? '隐藏模型' : '显示模型'
  })
}

init().catch(err => {
  console.error('[settings] init failed:', err)
})
