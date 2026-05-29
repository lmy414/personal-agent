/* @refresh reload */
import { render } from 'solid-js/web'
import { AgentProvider } from './shell/useAgent'
import { App } from './shell/App'
import './shell/App.css'
import './extensions/session-panel'
import './extensions/tool-panel'
import './extensions/chat-renderer'
import './extensions/chat-input'
import './extensions/status-bar'
import './extensions/right-panel'

render(() => (
  <AgentProvider sessionId="sess-default">
    <App />
  </AgentProvider>
), document.getElementById('root')!)
