import { createSignal } from 'solid-js'

export type SidebarMode = 'chat' | 'files'

export const [sidebarMode, setSidebarMode] = createSignal<SidebarMode>('chat')
