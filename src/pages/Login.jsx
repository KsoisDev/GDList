import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, LogIn, Mail } from 'lucide-react'
import AuthShell from '../components/auth/AuthShell'
import GoogleLogo from '../components/ui/GoogleLogo'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
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
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const returnPath = getReturnPath(location.state)

  if (authLoading) {
    return <AuthShell compact><div className={styles.centerStatus}><Spinner size="lg" /><p>{t('auth.restore')}</p></div></AuthShell>
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
          <span className={styles.kicker}>{t('auth.welcome')}</span>
          <h2 className={styles.title}>{t('auth.signInTitle')}</h2>
          <p className={styles.subtitle}>{t('auth.signInSubtitle')}</p>
        </div>

        {location.state?.notice && <p className={styles.notice} role="status">{location.state.notice}</p>}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <Input
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={event => setEmail(event.target.value)}
            icon={Mail}
            required
          />
          <Input
            label={t('auth.password')}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder={t('auth.enterPassword')}
            value={password}
            onChange={event => setPassword(event.target.value)}
            icon={Lock}
            required
          />
          <div className={styles.formOptions}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
              <span>{t('auth.keepSignedIn')}</span>
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />
              <span>{t('auth.showPassword')}</span>
            </label>
          </div>
          <div className={styles.forgotRow}><Link to="/forgot-password">{t('auth.forgot')}</Link></div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <Button type="submit" variant="primary" fullWidth loading={loading} icon={LogIn}>
            {t('nav.signIn')}
          </Button>
        </form>

        <div className={styles.divider}><span>{t('auth.continueWith')}</span></div>

        <Button variant="secondary" fullWidth onClick={handleGoogle} loading={loading} icon={GoogleLogo}>
          Google
        </Button>

        <p className={styles.footer}>{t('auth.newUser')} <Link to="/register" state={location.state}>{t('nav.createAccount')}</Link></p>
      </div>
    </AuthShell>
  )
}
