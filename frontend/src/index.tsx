/* @refresh reload */
import { render } from 'solid-js/web'
import { App } from './shell/App'
import './shell/App.css'
import './extensions/session-panel'
import './extensions/tool-panel'
import './extensions/chat-renderer'
import './extensions/chat-input'
import './extensions/status-bar'

render(() => <App />, document.getElementById('root')!)
