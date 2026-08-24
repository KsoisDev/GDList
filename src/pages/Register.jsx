import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, Mail, User, UserPlus } from 'lucide-react'
import AuthShell from '../components/auth/AuthShell'
import GoogleLogo from '../components/ui/GoogleLogo'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage, loginWithGoogle, registerWithEmail } from '../services/auth'
import { isValidUsername } from '../utils/validators'
import styles from './Auth.module.css'

function returnLocation(state) {
  const from = state?.from
  if (!from?.pathname || !from.pathname.startsWith('/') || from.pathname.startsWith('//')) {
    return { pathname: '/profile', search: '', hash: '' }
  }
  return from
}

function locationPath(location) {
  return `${location.pathname}${location.search || ''}${location.hash || ''}`
}

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const destination = returnLocation(location.state)

  if (authLoading) {
    return <AuthShell compact><div className={styles.centerStatus}><Spinner size="lg" /><p>Restoring your session…</p></div></AuthShell>
  }

  if (user) return <Navigate to={locationPath(destination)} replace />

  const validate = () => {
    if (!isValidUsername(username.trim())) return 'Username must be 3–20 characters using letters, numbers, hyphens, or underscores.'
    if (password.length < 8) return 'Use a password with at least 8 characters.'
    if (password !== confirmPassword) return 'The passwords do not match.'
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setLoading(true)
    try {
      await registerWithEmail(email, password, username, remember)
      navigate('/verify-email', { replace: true, state: { from: destination } })
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
      navigate(locationPath(destination), { replace: true })
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
          <span className={styles.kicker}>Join the ranking</span>
          <h2 className={styles.title}>Create your player account</h2>
          <p className={styles.subtitle}>Save completions, submit proof, and build your profile.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <Input label="Username" autoComplete="username" placeholder="PlayerName" value={username} onChange={event => setUsername(event.target.value)} icon={User} required />
          <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} icon={Mail} required />
          <div className={styles.passwordGrid}>
            <Input label="Password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="8+ characters" value={password} onChange={event => setPassword(event.target.value)} icon={Lock} required />
            <Input label="Confirm password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} icon={Lock} required />
          </div>
          <p className={styles.passwordHint}>Use at least 8 characters. A mix of words, numbers, and symbols is strongest.</p>
          <div className={styles.formOptions}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
              <span>Keep me signed in</span>
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />
              <span>Show passwords</span>
            </label>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <Button type="submit" variant="primary" fullWidth loading={loading} icon={UserPlus}>Create Account</Button>
        </form>

        <div className={styles.divider}><span>or continue with</span></div>
        <Button variant="secondary" fullWidth onClick={handleGoogle} loading={loading} icon={GoogleLogo}>Google</Button>
        <p className={styles.footer}>Already registered? <Link to="/login" state={location.state}>Sign in</Link></p>
      </div>
    </AuthShell>
  )
}
