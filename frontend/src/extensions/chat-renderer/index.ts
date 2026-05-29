import { registry } from '@/registry'
import { ChatRenderer } from './ChatRenderer'

registry.register({
  id: 'chat-renderer',
  slot: 'center',
  component: ChatRenderer,
})
