import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, LogIn } from 'lucide-react'
import { loginWithEmail, loginWithGoogle } from '../services/auth'
import { useAuth } from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card from '../components/ui/Card'
import styles from './Auth.module.css'

export default function Login() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    navigate('/profile')
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginWithEmail(email, password)
      navigate('/profile')
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').split('(')[0])
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle()
      navigate('/profile')
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').split('(')[0])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.container}
      >
        <Card padding="lg" className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              icon={Mail}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              icon={Lock}
              required
            />
            {error && <p className={styles.error}>{error}</p>}
            <Button type="submit" variant="primary" fullWidth loading={loading} icon={LogIn}>
              Sign In
            </Button>
          </form>

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <Button variant="secondary" fullWidth onClick={handleGoogle} loading={loading}>
            Continue with Google
          </Button>

          <p className={styles.footer}>
            Don&apos;t have an account?{' '}
            <Link to="/register">Create one</Link>
          </p>
        </Card>
      </motion.div>
    </div>
  )
}
