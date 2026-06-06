import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'
import { Avatar } from './Avatar'
import { ThinkingBlock } from './ThinkingBlock'
import type { AvatarStatus } from './Avatar'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  children: JSX.Element
  showAvatar: boolean
  avatarStatus?: AvatarStatus
  avatarLabel: string
  avatarImage?: string
  thinking?: string
}

export const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const isAssistant = props.role === 'assistant'

  return (
    <div class={`msg-row ${isAssistant ? 'msg-row--left' : 'msg-row--right'}`}>
      {isAssistant && (
        <div class="msg-avatar-slot">
          {props.showAvatar && (
            <Avatar label={props.avatarLabel} imagePath={props.avatarImage} status={props.avatarStatus} size={32} />
          )}
        </div>
      )}

      <div class={`msg-bubble-col ${isAssistant ? 'msg-bubble-col--left' : 'msg-bubble-col--right'}`}>
        {isAssistant && props.showAvatar && <span class="msg-sender-name">{props.avatarLabel}</span>}

        <Show when={isAssistant && props.thinking}>
          <ThinkingBlock steps={props.thinking!.length}>
            {props.thinking!}
          </ThinkingBlock>
        </Show>

        <div class={`msg-bubble ${isAssistant ? 'msg-bubble--assistant' : 'msg-bubble--user'}`}>
          {props.children}
        </div>
      </div>
    </div>
  )
}
