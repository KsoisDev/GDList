import { Component } from 'react'
import styles from './AppErrorBoundary.module.css'

function currentRoute() {
  try {
    return window.location.pathname + window.location.search + window.location.hash
  } catch {
    return ''
  }
}

export default class AppErrorBoundary extends Component {
  state = { error: null, copied: false }

  static getDerivedStateFromError(error) {
    return { error, copied: false }
  }

  componentDidCatch(error, info) {
    console.error('Route rendering failed:', error, info)
  }

  handleRetry = () => {
    this.setState({ error: null, copied: false })
  }

  handleCopy = async () => {
    const { error } = this.state
    const details = [
      `Route: ${currentRoute()}`,
      `Error: ${error?.message || String(error)}`,
      `Stack: ${error?.stack || 'n/a'}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(details)
      this.setState({ copied: true })
    } catch {
      // Clipboard unavailable (non-secure context, permissions): select the
      // text so it can be copied manually instead of failing silently.
      try {
        const ta = document.createElement('textarea')
        ta.value = details
        ta.setAttribute('readonly', '')
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        this.setState({ copied: true })
      } catch {
        this.setState({ copied: false })
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    const message = this.state.error?.message || 'Unknown rendering error'

    return (
      <main id="main-content" className={styles.page} tabIndex={-1}>
        <section className={styles.card} role="alert">
          <span className={styles.eyebrow}>Unexpected error</span>
          <h1>This page hit a wall.</h1>
          <p>The rest of the app is safe. Reload the page to try the request again.</p>
          <p className={styles.errorMessage}>{message}</p>
          <div className={styles.actions}>
            <button type="button" onClick={this.handleRetry}>Try Again</button>
            <button type="button" onClick={this.handleCopy}>
              {this.state.copied ? 'Copied!' : 'Copy Details'}
            </button>
            <button type="button" onClick={() => window.location.reload()}>Reload Page</button>
          </div>
        </section>
      </main>
    )
  }
}
