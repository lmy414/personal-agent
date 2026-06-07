import { registry } from '@/registry'
import { TopMenuBar } from './TopMenuBar'

registry.register({
  id: 'top-menu',
  slot: 'overlay',
  label: '顶部菜单',
  component: TopMenuBar,
})
