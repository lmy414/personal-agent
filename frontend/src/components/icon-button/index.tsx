import './index.css'

export interface IconButtonProps {
  icon: string
  onClick: () => void
  size?: 'sm' | 'md'
  variant?: 'ghost' | 'accent' | 'danger'
  title?: string
  disabled?: boolean
}

export function IconButton(props: IconButtonProps) {
  return (
    <button
      class="icon-btn"
      classList={{
        [`icon-btn--${props.size ?? 'md'}`]: true,
        [`icon-btn--${props.variant ?? 'ghost'}`]: true,
      }}
      onClick={props.onClick}
      title={props.title}
      disabled={props.disabled}
    >
      {props.icon}
    </button>
  )
}
