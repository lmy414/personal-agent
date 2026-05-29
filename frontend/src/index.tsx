/* @refresh reload */
import { render } from 'solid-js/web'
import { App } from './shell/App'
import './shell/App.css'
import './extensions/session-panel'
import './extensions/tool-panel'

render(() => <App />, document.getElementById('root')!)
