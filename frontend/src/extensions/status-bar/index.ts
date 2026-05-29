import { registry } from '@/registry'
import { StatusBar } from './StatusBar'

registry.register({
  id: 'status-bar',
  slot: 'left-bottom',
  component: StatusBar,
})
