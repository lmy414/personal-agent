/* @refresh reload */
import { render } from 'solid-js/web'
import { AgentProvider } from './shell/useAgent'
import { App } from './shell/App'
import './shell/App.css'
import './extensions/session-panel'
import './extensions/tool-panel'
import './extensions/chat-renderer'
import './extensions/status-bar'
import './extensions/file-tree'
import './extensions/doc-preview'
import './extensions/right-panel'
import './extensions/top-menu'
import './extensions/mini-nav'
import './extensions/sidebar'
import './extensions/chat-panel'
import './extensions/editor-panel'
import './views'

render(() => (
  <AgentProvider sessionId="sess-default">
    <App />
  </AgentProvider>
), document.getElementById('root')!)
