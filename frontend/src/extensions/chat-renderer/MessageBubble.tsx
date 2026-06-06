import type { Component, JSX } from 'solid-js'
import { Avatar } from './Avatar'
import type { AvatarStatus } from './Avatar'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  children: JSX.Element
  showAvatar: boolean
  avatarStatus?: AvatarStatus
}

export const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const isAssistant = props.role === 'assistant'

  return (
    <div class={`msg-row ${isAssistant ? 'msg-row--left' : 'msg-row--right'}`}>
      {/* 头像 — 左侧并排 */}
      {isAssistant && (
        <div class="msg-avatar-slot">
          {props.showAvatar && <Avatar label="澪" status={props.avatarStatus} size={32} />}
        </div>
      )}

      {/* 气泡 + 名字 */}
      <div class={`msg-bubble-col ${isAssistant ? 'msg-bubble-col--left' : 'msg-bubble-col--right'}`}>
        {isAssistant && props.showAvatar && <span class="msg-sender-name">澪</span>}
        <div class={`msg-bubble ${isAssistant ? 'msg-bubble--assistant' : 'msg-bubble--user'}`}>
          {props.children}
        </div>
      </div>
    </div>
  )
}
