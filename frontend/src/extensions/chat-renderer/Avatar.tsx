import type { Component } from 'solid-js'
import { Show } from 'solid-js'

export type AvatarStatus = 'idle' | 'thinking' | 'speaking'

interface AvatarProps {
  label: string
  status?: AvatarStatus
  size?: number
  imagePath?: string
}

const statusStyles: Record<AvatarStatus, string> = {
  idle: 'avatar-idle',
  thinking: 'avatar-thinking',
  speaking: 'avatar-speaking',
}

const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'])

function isImagePath(path: string): boolean {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
  return IMG_EXTS.has(ext)
}

export const Avatar: Component<AvatarProps> = (props) => {
  const s = props.size ?? 24
  const img = props.imagePath && isImagePath(props.imagePath) ? props.imagePath : null

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
      <Show when={img} fallback={<span>{props.label[0] ?? '?'}</span>}>
        <img src={`file://${img!.replace(/\\/g, '/')}`} alt={props.label} style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
      </Show>
    </div>
  )
}
