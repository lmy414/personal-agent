import type { JSX } from 'solid-js'
import './index.css'

export interface BadgeProps {
  children: JSX.Element
  variant?: 'default' | 'accent' | 'success'
  removable?: boolean
  onRemove?: () => void
}

export function Badge(props: BadgeProps) {
  return (
    <span class="badge" classList={{ [`badge--${props.variant ?? 'default'}`]: true }}>
      {props.children}
      {props.removable && (
        <button class="badge-remove" onClick={props.onRemove}>×</button>
      )}
    </span>
  )
}
