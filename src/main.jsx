import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import StartupError from './components/layout/StartupError'
import { MotionEffectsProvider } from './contexts/MotionEffectsContext'
import { firebaseConfigError } from './services/firebase'
import './styles/globals.css'
import './styles/animations.css'
import './styles/notifications.css'


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionEffectsProvider>
      {firebaseConfigError ? <StartupError message={firebaseConfigError} /> : <App />}
    </MotionEffectsProvider>
  </React.StrictMode>,
)
