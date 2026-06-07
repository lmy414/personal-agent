import { registry } from '@/registry'
import { MiniNav } from './MiniNav'

registry.register({
  id: 'mini-nav',
  slot: 'nav',
  label: '导航栏',
  component: MiniNav,
})
