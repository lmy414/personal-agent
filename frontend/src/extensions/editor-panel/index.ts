import { registry } from '@/registry'
import { EditorPanel } from './EditorPanel'

registry.register({
  id: 'editor-panel',
  slot: 'sidebar',
  label: '文件预览面板',
  component: EditorPanel,
})
