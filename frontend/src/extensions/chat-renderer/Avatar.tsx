import type { Component } from 'solid-js'

export type AvatarStatus = 'idle' | 'thinking' | 'speaking'

interface AvatarProps {
  label: string
  status?: AvatarStatus
  size?: number
}

const statusStyles: Record<AvatarStatus, string> = {
  idle: 'avatar-idle',
  thinking: 'avatar-thinking',
  speaking: 'avatar-speaking',
}

export const Avatar: Component<AvatarProps> = (props) => {
  const s = props.size ?? 24

  return (
    <div
      class={`avatar ${statusStyles[props.status ?? 'idle']}`}
      classList={{
        'avatar-ai': props.label !== 'U',
        'avatar-user': props.label === 'U',
      }}
      style={{
        width: `${s}px`,
        height: `${s}px`,
        'font-size': `${Math.floor(s * 0.45)}px`,
      }}
    >
      {props.label}
    </div>
  )
}
