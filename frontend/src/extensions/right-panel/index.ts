import { registry } from '@/registry'
import { RightPanelTabs } from './RightPanelTabs'

registry.register({
  id: 'right-panel',
  slot: 'right',
  label: '面板',
  component: RightPanelTabs,
})
