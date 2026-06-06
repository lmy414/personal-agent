import type { Component, JSX } from 'solid-js'
import { Avatar } from './Avatar'
import type { AvatarStatus } from './Avatar'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  children: JSX.Element
  /** 是否为同角色连续消息的第一条（决定是否显示头像） */
  showAvatar: boolean
  /** 头像状态（仅 assistant 有效） */
  avatarStatus?: AvatarStatus
}

export const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const isAssistant = props.role === 'assistant'

  return (
    <div class={`msg-block ${isAssistant ? 'msg-block--assistant' : 'msg-block--user'}`}>
      {isAssistant && props.showAvatar && (
        <div class="msg-sender">
          <Avatar label="澪" status={props.avatarStatus} size={28} />
          <span class="msg-sender-name">澪</span>
        </div>
      )}
      <div class={`msg-bubble ${isAssistant ? 'msg-bubble--assistant' : 'msg-bubble--user'}`}>
        {props.children}
      </div>
    </div>
  )
}
