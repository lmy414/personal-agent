import type { JSX } from 'solid-js'
import './index.css'

export interface GlassPanelProps {
  children: JSX.Element
  style?: string
  class?: string
}

export function GlassPanel(props: GlassPanelProps) {
  return (
    <div class="glass-panel" classList={{ [props.class ?? '']: !!props.class }} style={props.style}>
      {props.children}
    </div>
  )
}
