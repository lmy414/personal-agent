import { registry } from '@/registry'
import { FileTree } from './FileTree'

registry.register({
  id: 'file-tree',
  slot: 'right-tab',
  label: '文件',
  component: FileTree,
})
