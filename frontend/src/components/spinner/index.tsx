import './index.css'

export interface SpinnerProps {
  active: boolean
  size?: 'sm' | 'md'
}

export function Spinner(props: SpinnerProps) {
  return (
    <span
      class="spinner-dot"
      classList={{
        inactive: !props.active,
        running: props.active,
        'size-md': props.size === 'md',
      }}
    />
  )
}
