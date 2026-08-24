import { Component } from 'react'
import styles from './AppErrorBoundary.module.css'

export default class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Route rendering failed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main id="main-content" className={styles.page} tabIndex={-1}>
        <section className={styles.card} role="alert">
          <span className={styles.eyebrow}>Unexpected error</span>
          <h1>This page hit a wall.</h1>
          <p>The rest of the app is safe. Reload the page to try the request again.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload Page</button>
        </section>
      </main>
    )
  }
}
