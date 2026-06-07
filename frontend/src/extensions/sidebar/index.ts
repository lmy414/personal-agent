import { registry } from '@/registry'
import { Sidebar } from './Sidebar'

registry.register({
  id: 'sidebar',
  slot: 'sidebar',
  label: '侧边栏',
  component: Sidebar,
})
