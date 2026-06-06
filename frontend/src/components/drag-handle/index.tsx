export interface DragHandleProps {
  onDrag: (deltaX: number) => void
  onDragEnd?: () => void
  onDoubleClick?: () => void
  axis?: 'x' | 'y'
}

const HANDLE_STYLE =
  'position:absolute;left:-5px;top:0;bottom:0;width:10px;cursor:col-resize;z-index:10'

export function DragHandle(props: DragHandleProps) {
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
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
      style={HANDLE_STYLE}
      onMouseDown={handleMouseDown}
      onDblClick={props.onDoubleClick}
    />
  )
}
