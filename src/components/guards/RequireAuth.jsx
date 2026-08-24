import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Spinner from '../ui/Spinner'
import styles from './Guards.module.css'

function LoadingState() {
  return (
    <div className={styles.loading} role="status" aria-label="Checking account access">
      <Spinner size="lg" />
    </div>
  )
}

function AccountState({ title, message, action }) {
  return (
    <main className={styles.statePage}>
      <section className={styles.stateCard} role="alert">
        <h1 className={styles.stateTitle}>{title}</h1>
        <p className={styles.stateMessage}>{message}</p>
        {action}
      </section>
    </main>
  )
}

export default function RequireAuth({ children }) {
  const { user, userData, loading, profileError, retryProfile } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState />

  if (profileError || (user && !userData)) {
    return (
      <AccountState
        title="We couldn't load your account"
        message="Your sign-in is active, but your profile is temporarily unavailable. Check your connection and try again."
        action={(
          <button className={styles.stateButton} type="button" onClick={() => retryProfile().catch(() => {})}>
            Try again
          </button>
        )}
      />
    )
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, returnTo }}
      />
    )
  }

  if (userData.banned) {
    return (
      <AccountState
        title="Account suspended"
        message="This account cannot use member-only features. If you believe this is a mistake, contact a site administrator."
        action={<Link className={styles.stateButton} to="/">Return home</Link>}
      />
    )
  }

  return children
}

export { LoadingState }
