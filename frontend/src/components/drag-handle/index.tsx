import './index.css'

export interface DragHandleProps {
  onDrag: (deltaX: number) => void
  onDragEnd?: () => void
  onDoubleClick?: () => void
  axis?: 'x' | 'y'
}

export function DragHandle(props: DragHandleProps) {
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const handle = e.currentTarget as HTMLElement
    handle.classList.add('dragging')
    document.body.style.userSelect = 'none'
    document.body.style.cursor =
      (props.axis ?? 'x') === 'x' ? 'col-resize' : 'row-resize'

    const onMove = (ev: MouseEvent) => {
      if ((props.axis ?? 'x') === 'x') {
        props.onDrag(ev.clientX - startX)
      } else {
        props.onDrag(ev.clientY - startY)
      }
    }

    const onUp = () => {
      handle.classList.remove('dragging')
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      props.onDragEnd?.()
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      class="drag-handle"
      onMouseDown={handleMouseDown}
      onDblClick={props.onDoubleClick}
    />
  )
}
