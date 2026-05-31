import { registry } from '@/registry'
import { Live2DView } from './Live2DView'

registry.register({
  id: 'live2d-view',
  slot: 'right-tab',
  label: 'Live2D',
  component: Live2DView,
})
