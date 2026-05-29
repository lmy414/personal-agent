import { registry } from '@/registry'
import { ToolPanel } from './ToolPanel'

registry.register({
  id: 'tool-panel',
  slot: 'left-middle',
  component: ToolPanel,
})
