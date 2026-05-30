import { registry } from '@/registry'
import { MemoryView } from './MemoryView'

registry.register({
  id: 'memory-view',
  slot: 'right-tab',
  label: '记忆',
  component: MemoryView,
})
