import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, MailCheck, RefreshCw } from 'lucide-react'
import AuthShell from '../components/auth/AuthShell'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage, refreshVerificationStatus, resendVerificationEmail, usesPasswordProvider } from '../services/auth'
import styles from './Auth.module.css'

function getDestination(state) {
  const from = state?.from
  if (!from?.pathname || !from.pathname.startsWith('/') || from.pathname.startsWith('//')) return '/profile'
  return `${from.pathname}${from.search || ''}${from.hash || ''}`
}

export default function VerifyEmail() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const destination = getDestination(location.state)

  if (loading) return <AuthShell compact><div className={styles.centerStatus}><Spinner size="lg" /><p>Checking your account…</p></div></AuthShell>
  if (!user) return <Navigate to="/login" replace state={{ notice: 'Sign in to verify your email.', from: location.state?.from }} />

  const isVerified = user.emailVerified || !usesPasswordProvider(user)

  const checkStatus = async () => {
    setChecking(true)
    setError('')
    try {
      const verified = await refreshVerificationStatus()
      if (verified) navigate(destination, { replace: true })
      else setMessage('Not verified yet. Open the link in your email, then check again.')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setChecking(false)
    }
  }

  const resend = async () => {
    setSending(true)
    setError('')
    setMessage('')
    try {
      await resendVerificationEmail()
      setMessage('A fresh verification email has been sent.')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthShell compact>
      <div className={styles.authContent}>
        <div className={styles.iconBadge}>{isVerified ? <CheckCircle2 size={28} /> : <MailCheck size={28} />}</div>
        <div className={styles.header}>
          <span className={styles.kicker}>{isVerified ? 'Account ready' : 'One last step'}</span>
          <h2 className={styles.title}>{isVerified ? 'Your account is verified' : 'Verify your email'}</h2>
          <p className={styles.subtitle}>
            {isVerified ? 'You can now use every player feature.' : <>We sent a link to <strong>{user.email}</strong>. Verification protects submissions and account recovery.</>}
          </p>
        </div>
        {message && <p className={styles.notice} role="status">{message}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.stackActions}>
          {isVerified ? (
            <Button variant="primary" fullWidth onClick={() => navigate(destination, { replace: true })}>Continue</Button>
          ) : (
            <>
              <Button variant="primary" fullWidth onClick={checkStatus} loading={checking} icon={RefreshCw}>I’ve Verified — Check Again</Button>
              <Button variant="secondary" fullWidth onClick={resend} loading={sending}>Resend Email</Button>
              <Link to={destination} className={styles.laterLink}>I’ll verify later</Link>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  )
}
