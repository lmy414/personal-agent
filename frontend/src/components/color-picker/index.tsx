import { createSignal, Show, onCleanup, onMount, createEffect } from 'solid-js'
import './index.css'

export interface ColorPickerProps {
  value: string
  onChange: (hex: string) => void
  onReset?: () => void
  showReset?: boolean
}

const SWATCHES = [
  '#6B8FA8', '#5B8C5A', '#C8963E', '#8B7FB8', '#7A8B94',
  '#4A90D9', '#3D8B7A', '#D4764E', '#9B6B9E', '#6E7B8B',
  '#2E86AB', '#5DAE8B', '#E8A838', '#A855F7', '#94A3B8',
  '#1B998B', '#C77DBA', '#F97316', '#EC4899', '#64748B',
]

// ── hex / hsv / rgb 互转 ──
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  }
}

export function ColorPicker(props: ColorPickerProps) {
  const [open, setOpen] = createSignal(false)
  const [tab, setTab] = createSignal<'swatches' | 'picker'>('swatches')

  // HSV 状态
  const [hue, setHue] = createSignal(210)
  const [sat, setSat] = createSignal(0.3)
  const [val, setVal] = createSignal(0.66)

  // 从 props.value 初始化 HSV
  const syncFromHex = (hex: string) => {
    const rgb = hexToRgb(hex)
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
    setHue(hsv.h)
    setSat(hsv.s)
    setVal(hsv.v)
  }

  // 点击外部关闭
  let panelRef: HTMLDivElement | undefined
  let triggerRef: HTMLButtonElement | undefined
  const handleDocClick = (e: MouseEvent) => {
    if (panelRef && !panelRef.contains(e.target as Node)) setOpen(false)
  }
  onMount(() => document.addEventListener('mousedown', handleDocClick))
  onCleanup(() => document.removeEventListener('mousedown', handleDocClick))

  // 自适应定位：根据触发按钮在视口中的位置决定面板展开方向
  const updatePosition = () => {
    if (!panelRef || !triggerRef) return
    const rect = triggerRef.getBoundingClientRect()
    const panelH = panelRef.offsetHeight || 320
    const panelW = panelRef.offsetWidth || 240
    const vw = window.innerWidth
    const vh = window.innerHeight

    // 垂直方向：下方空间不足则向上展开
    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    let top: number
    if (spaceBelow >= panelH + 8 || spaceBelow >= spaceAbove) {
      top = rect.bottom + 8
    } else {
      top = rect.top - panelH - 8
    }

    // 水平方向：右对齐，右侧空间不足则左对齐
    let left = rect.right - panelW
    if (left < 8) left = 8
    if (left + panelW > vw - 8) left = vw - panelW - 8

    panelRef.style.top = `${top}px`
    panelRef.style.left = `${left}px`
  }

  // 打开时计算位置
  createEffect(() => {
    if (open()) {
      // DOM 更新后计算
      requestAnimationFrame(updatePosition)
    }
  })

  // 饱和度/明度面板拖拽
  let svRef: HTMLDivElement | undefined
  const [draggingSV, setDraggingSV] = createSignal(false)

  const updateSV = (clientX: number, clientY: number) => {
    if (!svRef) return
    const rect = svRef.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    setSat(x)
    setVal(1 - y)
    const rgb = hsvToRgb(hue(), x, 1 - y)
    props.onChange(rgbToHex(rgb.r, rgb.g, rgb.b))
  }

  const handleSVMouseDown = (e: MouseEvent) => {
    setDraggingSV(true)
    updateSV(e.clientX, e.clientY)
  }
  const handleSVMouseMove = (e: MouseEvent) => {
    if (draggingSV()) updateSV(e.clientX, e.clientY)
  }
  const handleSVMouseUp = () => setDraggingSV(false)

  onMount(() => {
    document.addEventListener('mousemove', handleSVMouseMove)
    document.addEventListener('mouseup', handleSVMouseUp)
  })
  onCleanup(() => {
    document.removeEventListener('mousemove', handleSVMouseMove)
    document.removeEventListener('mouseup', handleSVMouseUp)
  })

  // 色相条拖拽
  let hueRef: HTMLDivElement | undefined
  const [draggingHue, setDraggingHue] = createSignal(false)

  const updateHue = (clientX: number) => {
    if (!hueRef) return
    const rect = hueRef.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const h = x * 360
    setHue(h)
    const rgb = hsvToRgb(h, sat(), val())
    props.onChange(rgbToHex(rgb.r, rgb.g, rgb.b))
  }

  const handleHueMouseDown = (e: MouseEvent) => {
    setDraggingHue(true)
    updateHue(e.clientX)
  }
  const handleHueMouseMove = (e: MouseEvent) => {
    if (draggingHue()) updateHue(e.clientX)
  }
  const handleHueMouseUp = () => setDraggingHue(false)

  onMount(() => {
    document.addEventListener('mousemove', handleHueMouseMove)
    document.addEventListener('mouseup', handleHueMouseUp)
  })
  onCleanup(() => {
    document.removeEventListener('mousemove', handleHueMouseMove)
    document.removeEventListener('mouseup', handleHueMouseUp)
  })

  const currentHex = () => {
    const rgb = hsvToRgb(hue(), sat(), val())
    return rgbToHex(rgb.r, rgb.g, rgb.b)
  }

  return (
    <div class="color-picker">
      <button
        class="color-picker__trigger"
        ref={triggerRef}
        onClick={() => { syncFromHex(props.value); setOpen(!open()) }}
        type="button"
      >
        <span class="color-picker__swatch" style={{ background: props.value }} />
        <span class="color-picker__hex">{props.value}</span>
      </button>

      <Show when={props.showReset && props.onReset}>
        <button class="color-picker__reset" onClick={props.onReset} type="button">
          重置
        </button>
      </Show>

      <Show when={open()}>
        <div class="color-picker__panel" ref={panelRef}>
          {/* ── 面板标题栏 ── */}
          <div class="color-picker__header">
            <div class="color-picker__tabs">
              <button
                class="color-picker__tab"
                classList={{ 'color-picker__tab--active': tab() === 'swatches' }}
                onClick={() => setTab('swatches')}
                type="button"
              >
                色板
              </button>
              <button
                class="color-picker__tab"
                classList={{ 'color-picker__tab--active': tab() === 'picker' }}
                onClick={() => setTab('picker')}
                type="button"
              >
                拾取
              </button>
            </div>
            <button class="color-picker__close" onClick={() => setOpen(false)} type="button">✕</button>
          </div>

          {/* ── 色板页 ── */}
          <Show when={tab() === 'swatches'}>
            <div class="color-picker__swatches">
              {SWATCHES.map(c => (
                <button
                  class="color-picker__swatch-btn"
                  classList={{ 'color-picker__swatch-btn--active': props.value.toUpperCase() === c.toUpperCase() }}
                  style={{ background: c }}
                  onClick={() => { props.onChange(c); syncFromHex(c) }}
                  type="button"
                />
              ))}
            </div>
            <div class="color-picker__custom-row">
              <span class="color-picker__custom-label">自定义</span>
              <input
                class="color-picker__hex-input"
                type="text"
                value={props.value}
                placeholder="#000000"
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim()
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) { props.onChange(v); syncFromHex(v) }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
              />
            </div>
          </Show>

          {/* ── 拾取页（自绘 HSV） ── */}
          <Show when={tab() === 'picker'}>
            <div class="color-picker__picker">
              {/* SV 面板 */}
              <div
                class="color-picker__sv"
                ref={svRef}
                onMouseDown={handleSVMouseDown}
                style={{
                  background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue()}, 100%, 50%))`,
                }}
              >
                <div
                  class="color-picker__sv-thumb"
                  style={{
                    left: `${sat() * 100}%`,
                    top: `${(1 - val()) * 100}%`,
                    'background-color': currentHex(),
                  }}
                />
              </div>

              {/* 色相条 */}
              <div
                class="color-picker__hue"
                ref={hueRef}
                onMouseDown={handleHueMouseDown}
              >
                <div
                  class="color-picker__hue-thumb"
                  style={{ left: `${(hue() / 360) * 100}%` }}
                />
              </div>

              {/* 预览 + RGB 输入 */}
              <div class="color-picker__preview-row">
                <div class="color-picker__preview" style={{ background: currentHex() }} />
                <div class="color-picker__rgb-inputs">
                  {(['R', 'G', 'B'] as const).map((ch, i) => {
                    const rgb = hexToRgb(currentHex())
                    const val = [rgb.r, rgb.g, rgb.b][i]
                    return (
                      <div class="color-picker__rgb-group">
                        <input
                          class="color-picker__rgb-input"
                          type="number"
                          min={0} max={255}
                          value={val}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(255, parseInt(e.currentTarget.value) || 0))
                            const cur = hexToRgb(currentHex())
                            const newRgb = i === 0 ? { ...cur, r: v } : i === 1 ? { ...cur, g: v } : { ...cur, b: v }
                            const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                            props.onChange(hex)
                            syncFromHex(hex)
                          }}
                        />
                        <span class="color-picker__rgb-label">{ch}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
