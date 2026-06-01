import { createSignal } from 'solid-js'

function loadNum(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key)
    if (v !== null) {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  } catch {}
  return fallback
}

function saveNum(key: string, value: number): void {
  try { localStorage.setItem(key, String(value)) } catch {}
}

// ── 面板尺寸 ──
const [live2dWidth, setLive2dWidthRaw] = createSignal(loadNum('mio:live2d-width', 280))
const [live2dHeight, setLive2dHeightRaw] = createSignal(loadNum('mio:live2d-height', 380))

function setLive2dWidth(v: number) { const c = Math.max(200, Math.min(500, v)); setLive2dWidthRaw(c); saveNum('mio:live2d-width', c) }
function setLive2dHeight(v: number) { const c = Math.max(260, Math.min(650, v)); setLive2dHeightRaw(c); saveNum('mio:live2d-height', c) }

// ── 模型缩放（0 = 自动计算，百分比 >=1）──
const rawScale = loadNum('mio:live2d-scale', 0)
const [live2dScale, setLive2dScaleRaw] = createSignal(rawScale > 0 && rawScale < 1 ? 0 : rawScale)
function setLive2dScale(v: number) { setLive2dScaleRaw(v); saveNum('mio:live2d-scale', v) }

// ── 模型位置偏移（px），钳制在合理范围内 ──
function clampOffset(v: number) { return Math.max(-500, Math.min(500, v)) }
const rawOx = clampOffset(loadNum('mio:live2d-offset-x', 0))
const rawOy = clampOffset(loadNum('mio:live2d-offset-y', 0))
// 写入修正后的值覆盖历史上可能存脏的 localStorage
if (rawOx !== 0) saveNum('mio:live2d-offset-x', rawOx)
if (rawOy !== 0) saveNum('mio:live2d-offset-y', rawOy)
const [live2dOffsetX, setLive2dOffsetXRaw] = createSignal(rawOx)
const [live2dOffsetY, setLive2dOffsetYRaw] = createSignal(rawOy)
function setLive2dOffsetX(v: number) { const c = clampOffset(v); setLive2dOffsetXRaw(c); saveNum('mio:live2d-offset-x', c) }
function setLive2dOffsetY(v: number) { const c = clampOffset(v); setLive2dOffsetYRaw(c); saveNum('mio:live2d-offset-y', c) }

// ── 显示/隐藏 ──
const [live2dVisible, setLive2dVisible] = createSignal(true)

export {
  live2dWidth, setLive2dWidth,
  live2dHeight, setLive2dHeight,
  live2dScale, setLive2dScale,
  live2dOffsetX, setLive2dOffsetX,
  live2dOffsetY, setLive2dOffsetY,
  live2dVisible, setLive2dVisible,
}
