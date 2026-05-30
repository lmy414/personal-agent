import { registry } from '@/registry'
import { DocPreview } from './DocPreview'

registry.register({
  id: 'doc-preview',
  slot: 'right-tab',
  label: '预览',
  component: DocPreview,
})
