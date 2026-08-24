import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App'
import StartupError from './components/layout/StartupError'
import { firebaseConfigError } from './services/firebase'
import './styles/globals.css'
import './styles/animations.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      {firebaseConfigError ? <StartupError message={firebaseConfigError} /> : <App />}
    </MotionConfig>
  </React.StrictMode>,
)
