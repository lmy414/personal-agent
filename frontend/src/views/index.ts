import { registry } from '@/registry'
import PencilMainView from './PencilMainView'
import CharacterView from './CharacterView'
import SessionRecordsView from './SessionRecordsView'
import CostDashboardView from './CostDashboardView'
import SettingsLayoutView from './SettingsLayoutView'

registry.register({ id: 'chat',     slot: 'main-view', label: '通信',   component: PencilMainView })
registry.register({ id: 'agents',   slot: 'main-view', label: '識別',   component: CharacterView })
registry.register({ id: 'records',  slot: 'main-view', label: '記録',   component: SessionRecordsView })
registry.register({ id: 'resources',slot: 'main-view', label: '資源',   component: CostDashboardView })
registry.register({ id: 'settings', slot: 'main-view', label: '設定',   component: SettingsLayoutView })
