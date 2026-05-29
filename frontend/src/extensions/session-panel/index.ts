import { registry } from '@/registry'
import { SessionPanel } from './SessionPanel'

registry.register({
  id: 'session-panel',
  slot: 'left-top',
  component: SessionPanel,
})
