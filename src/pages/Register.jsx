import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, Mail, User, UserPlus } from 'lucide-react'
import AuthShell from '../components/auth/AuthShell'
import GoogleLogo from '../components/ui/GoogleLogo'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
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
  const { t } = useLanguage()
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
    return <AuthShell compact><div className={styles.centerStatus}><Spinner size="lg" /><p>{t('auth.restore')}</p></div></AuthShell>
  }

  if (user) return <Navigate to={locationPath(destination)} replace />

  const validate = () => {
    if (!isValidUsername(username.trim())) return t('auth.usernameError')
    if (password.length < 8) return t('auth.passwordError')
    if (password !== confirmPassword) return t('auth.passwordMatchError')
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
          <span className={styles.kicker}>{t('auth.joinKicker')}</span>
          <h2 className={styles.title}>{t('auth.registerTitle')}</h2>
          <p className={styles.subtitle}>{t('auth.registerSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <Input label={t('auth.username')} autoComplete="username" placeholder="PlayerName" value={username} onChange={event => setUsername(event.target.value)} icon={User} required />
          <Input label={t('auth.email')} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} icon={Mail} required />
          <div className={styles.passwordGrid}>
            <Input label={t('auth.password')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder={t('auth.passwordPlaceholder')} value={password} onChange={event => setPassword(event.target.value)} icon={Lock} required />
            <Input label={t('auth.confirmPassword')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder={t('auth.repeatPassword')} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} icon={Lock} required />
          </div>
          <p className={styles.passwordHint}>{t('auth.passwordHint')}</p>
          <div className={styles.formOptions}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
              <span>{t('auth.keepSignedIn')}</span>
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />
              <span>{t('auth.showPasswords')}</span>
            </label>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <Button type="submit" variant="primary" fullWidth loading={loading} icon={UserPlus}>{t('nav.createAccount')}</Button>
        </form>

        <div className={styles.divider}><span>{t('auth.continueWith')}</span></div>
        <Button variant="secondary" fullWidth onClick={handleGoogle} loading={loading} icon={GoogleLogo}>Google</Button>
        <p className={styles.footer}>{t('auth.already')} <Link to="/login" state={location.state}>{t('nav.signIn')}</Link></p>
      </div>
    </AuthShell>
  )
}
