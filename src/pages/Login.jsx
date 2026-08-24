import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, LogIn, Mail } from 'lucide-react'
import AuthShell from '../components/auth/AuthShell'
import GoogleLogo from '../components/ui/GoogleLogo'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage, loginWithEmail, loginWithGoogle } from '../services/auth'
import styles from './Auth.module.css'

function getReturnPath(state) {
  const from = state?.from
  if (!from?.pathname || !from.pathname.startsWith('/') || from.pathname.startsWith('//')) return '/profile'
  return `${from.pathname}${from.search || ''}${from.hash || ''}`
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const returnPath = getReturnPath(location.state)

  if (authLoading) {
    return <AuthShell compact><div className={styles.centerStatus}><Spinner size="lg" /><p>Restoring your session…</p></div></AuthShell>
  }

  if (user) return <Navigate to={returnPath} replace />

  const finishSignIn = () => navigate(returnPath, { replace: true })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginWithEmail(email, password, remember)
      finishSignIn()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle(remember)
      finishSignIn()
    } catch (err) {
      if (err?.code !== 'auth/cancelled-popup-request') setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className={styles.authContent}>
        <div className={styles.header}>
          <span className={styles.kicker}>Welcome back</span>
          <h2 className={styles.title}>Sign in to Basement</h2>
          <p className={styles.subtitle}>Continue your list progress and manage submissions.</p>
        </div>

        {location.state?.notice && <p className={styles.notice} role="status">{location.state.notice}</p>}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={event => setEmail(event.target.value)}
            icon={Mail}
            required
          />
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            icon={Lock}
            required
          />
          <div className={styles.formOptions}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
              <span>Keep me signed in</span>
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />
              <span>Show password</span>
            </label>
          </div>
          <div className={styles.forgotRow}><Link to="/forgot-password">Forgot password?</Link></div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <Button type="submit" variant="primary" fullWidth loading={loading} icon={LogIn}>
            Sign In
          </Button>
        </form>

        <div className={styles.divider}><span>or continue with</span></div>

        <Button variant="secondary" fullWidth onClick={handleGoogle} loading={loading} icon={GoogleLogo}>
          Google
        </Button>

        <p className={styles.footer}>New to the list? <Link to="/register" state={location.state}>Create an account</Link></p>
      </div>
    </AuthShell>
  )
}
