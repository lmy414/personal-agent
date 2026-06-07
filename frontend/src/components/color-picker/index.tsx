import { createSignal, Show } from 'solid-js'
import './index.css'

export interface ColorPickerProps {
  /** 当前颜色 hex 值，如 #6B8FA8 */
  value: string
  /** 颜色变更回调 */
  onChange: (hex: string) => void
  /** 可选的重置回调，传入时显示重置按钮 */
  onReset?: () => void
  /** 是否显示重置按钮 */
  showReset?: boolean
}

/** 预设色板 — 精选 18 色 */
const SWATCHES = [
  '#6B8FA8', '#5B8C5A', '#C8963E', '#8B7FB8', '#7A8B94',
  '#4A90D9', '#3D8B7A', '#D4764E', '#9B6B9E', '#6E7B8B',
  '#2E86AB', '#5DAE8B', '#E8A838', '#A855F7', '#94A3B8',
  '#1B998B', '#C77DBA', '#F97316', '#EC4899', '#64748B',
]

export function ColorPicker(props: ColorPickerProps) {
  const [open, setOpen] = createSignal(false)

  return (
    <div class="color-picker">
      <button
        class="color-picker__trigger"
        onClick={() => setOpen(!open())}
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
        <div class="color-picker__panel">
          <div class="color-picker__swatches">
            {SWATCHES.map(c => (
              <button
                class="color-picker__swatch-btn"
                classList={{ 'color-picker__swatch-btn--active': props.value.toUpperCase() === c.toUpperCase() }}
                style={{ background: c }}
                onClick={() => { props.onChange(c); setOpen(false) }}
                type="button"
              />
            ))}
          </div>
          <div class="color-picker__custom">
            <span class="color-picker__custom-label">自定义</span>
            <div class="color-picker__custom-input-wrap">
              <span class="color-picker__custom-preview" style={{ background: props.value }} />
              <input
                class="color-picker__native"
                type="color"
                value={props.value}
                onInput={(e) => props.onChange(e.currentTarget.value)}
              />
              <input
                class="color-picker__hex-input"
                type="text"
                value={props.value}
                placeholder="#000000"
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim()
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) props.onChange(v)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
              />
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
