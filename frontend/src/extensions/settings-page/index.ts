import { registry } from '@/registry'
import { SettingsPage } from './SettingsPage'

registry.register({
  id: 'settings-page',
  slot: 'center',
  component: SettingsPage,
})
