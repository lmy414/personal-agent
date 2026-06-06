import './index.css'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Toggle(props: ToggleProps) {
  return (
    <button
      class="toggle"
      classList={{ on: props.checked }}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      role="switch"
      aria-checked={props.checked}
    />
  )
}
