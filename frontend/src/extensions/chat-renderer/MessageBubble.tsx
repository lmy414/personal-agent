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
  /** 思考内容（仅 assistant 流式时传入） */
  thinking?: string
}

export const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const isAssistant = props.role === 'assistant'

  return (
    <div class={`msg-row ${isAssistant ? 'msg-row--left' : 'msg-row--right'}`}>
      {isAssistant && (
        <div class="msg-avatar-slot">
          {props.showAvatar && <Avatar label="澪" status={props.avatarStatus} size={32} />}
        </div>
      )}

      <div class={`msg-bubble-col ${isAssistant ? 'msg-bubble-col--left' : 'msg-bubble-col--right'}`}>
        {isAssistant && props.showAvatar && <span class="msg-sender-name">澪</span>}

        {/* 思考过程 — 名字下面、气泡上面 */}
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
