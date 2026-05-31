import { registry } from '@/registry'
import { TopMenuBar } from './TopMenuBar'

registry.register({
  id: 'top-menu',
  slot: 'center',
  component: TopMenuBar,
})
