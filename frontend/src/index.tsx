/* @refresh reload */
import { render } from 'solid-js/web'
import { App } from './shell/App'
import './shell/App.css'
import './extensions/session-panel'

render(() => <App />, document.getElementById('root')!)
