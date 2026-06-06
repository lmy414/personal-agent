import './index.css'

export interface GlassInputProps {
  value: string
  onInput: (value: string) => void
  placeholder?: string
  type?: 'text' | 'search'
  style?: string
}

export function GlassInput(props: GlassInputProps) {
  return (
    <input
      class="glass-input"
      type={props.type ?? 'text'}
      value={props.value}
      placeholder={props.placeholder}
      style={props.style}
      onInput={(e) => props.onInput(e.currentTarget.value)}
    />
  )
}
