import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, Send } from 'lucide-react'
import AuthShell from '../components/auth/AuthShell'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { getAuthErrorMessage, resetPassword } from '../services/auth'
import styles from './Auth.module.css'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      if (err?.code === 'auth/user-not-found') setSent(true)
      else setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell compact>
      <div className={styles.authContent}>
        <Link to="/login" className={styles.backLink}><ArrowLeft size={16} /> Back to sign in</Link>
        <div className={styles.header}>
          <span className={styles.kicker}>Account recovery</span>
          <h2 className={styles.title}>Reset your password</h2>
          <p className={styles.subtitle}>Enter your account email and we’ll send a secure reset link.</p>
        </div>

        {sent ? (
          <div className={styles.successPanel} role="status">
            <Send size={24} />
            <h3>Check your inbox</h3>
            <p>If an account exists for <strong>{email}</strong>, a reset link is on its way. Check spam if it does not arrive.</p>
            <Button to="/login" variant="primary" fullWidth>Return to Sign In</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} icon={Mail} required />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <Button type="submit" variant="primary" fullWidth loading={loading} icon={Send}>Send Reset Link</Button>
          </form>
        )}
      </div>
    </AuthShell>
  )
}
