import { registry } from '@/registry'
import { ChatInput } from './ChatInput'

registry.register({
  id: 'chat-input',
  slot: 'center',
  component: ChatInput,
})
