// Live2DView is now rendered at root level in App.tsx (alongside SceneLayer/TopMenuBar/SettingsPage)
// The registry entry is kept as a no-op to avoid breaking imports.
// Previously registered as slot: 'right-tab', but that slot was never rendered by App.tsx.
//
// To use: import { Live2DView } from '@/extensions/live2d-view/Live2DView'
export { Live2DView } from './Live2DView'
