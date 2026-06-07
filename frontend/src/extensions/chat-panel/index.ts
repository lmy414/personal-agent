import { registry } from '@/registry'
import { ChatPanel } from './ChatPanel'

registry.register({
  id: 'chat-panel',
  slot: 'sidebar',
  label: '聊天面板',
  component: ChatPanel,
})
