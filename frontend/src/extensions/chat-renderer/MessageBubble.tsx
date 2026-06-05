import type { Component, JSX } from 'solid-js'
import { Avatar } from './Avatar'
import type { AvatarStatus } from './Avatar'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  children: JSX.Element
  avatarLabel: string
  avatarStatus?: AvatarStatus
}

export const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const isUser = props.role === 'user'

  return (
    <div class={`msg ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && <Avatar label={props.avatarLabel} status={props.avatarStatus} size={24} />}
      <div class="msg-bubble">{props.children}</div>
      {isUser && <Avatar label={props.avatarLabel} size={20} />}
    </div>
  )
}
