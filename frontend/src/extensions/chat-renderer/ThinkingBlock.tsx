import { createSignal, type Component } from 'solid-js'
import { ChevronRight } from 'lucide-solid'

interface ThinkingBlockProps {
  steps: number
  children?: string
}

export const ThinkingBlock: Component<ThinkingBlockProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false)

  return (
    <div class="thinking-block">
      <button class="thinking-toggle" onClick={() => setExpanded(!expanded())}>
        <ChevronRight
          size={12}
          class="thinking-arrow"
          classList={{ 'thinking-arrow-open': expanded() }}
        />
        <span class="thinking-label">思考过程</span>
        <span class="thinking-count">({props.steps} 步)</span>
      </button>
      {expanded() && (
        <div class="thinking-content">{props.children ?? '(无内容)'}</div>
      )}
    </div>
  )
}
