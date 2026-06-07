import { createSignal } from 'solid-js'

export type ViewId = 'chat' | 'agents' | 'records' | 'resources' | 'files' | 'settings'

export const [activeView, navigateTo] = createSignal<ViewId>('chat')
