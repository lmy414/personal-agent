/* @refresh reload */
import { render } from 'solid-js/web'
import { AgentProvider } from './shell/useAgent'
import { App } from './shell/App'
import './shell/App.css'
import './extensions/session-panel'
import './extensions/tool-panel'
import './extensions/chat-renderer'
// chat-input now merged into chat-renderer (ChatRenderer includes ChatInput)
import './extensions/status-bar'
import './extensions/file-tree'
import './extensions/doc-preview'
import './extensions/right-panel'
import './extensions/top-menu'
import './extensions/settings-page'
import './extensions/live2d-view'

render(() => (
  <AgentProvider sessionId="sess-default">
    <App />
  </AgentProvider>
), document.getElementById('root')!)
