import './index.css'

export interface ProgressBarProps {
  value: number
  max: number
  showLabel?: boolean
  warnThreshold?: number
  dangerThreshold?: number
}

export function ProgressBar(props: ProgressBarProps) {
  const pct = () => Math.min(100, props.max > 0 ? (props.value / props.max) * 100 : 0)
  const level = () => {
    const danger = props.dangerThreshold ?? 80
    const warn = props.warnThreshold ?? 60
    if (pct() > danger) return 'danger'
    if (pct() > warn) return 'warn'
    return ''
  }

  return (
    <div class="progress-bar-wrap">
      {props.showLabel && (
        <div class="progress-bar-label">
          <span>上下文用量</span>
          <span>{props.value.toLocaleString()} / {props.max.toLocaleString()}</span>
        </div>
      )}
      <div class="progress-bar-track">
        <div
          class="progress-bar-fill"
          classList={{ warn: level() === 'warn', danger: level() === 'danger' }}
          style={{ width: `${pct()}%` }}
        />
      </div>
    </div>
  )
}
