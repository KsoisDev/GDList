import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListCheck, Users, Layers, FileText } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { getCollection } from '../../services/firestore'
import styles from './Admin.module.css'

export default function AdminDashboard() {
  const { user, userData, loading } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ users: 0, levels: 0, pending: 0, completions: 0 })
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && (!user || userData?.role !== 'admin')) {
      navigate('/')
    }
  }, [user, userData, loading, navigate])

  useEffect(() => {
    async function load() {
      try {
        const [users, levels, submissions, completions] = await Promise.all([
          getCollection('users'),
          getCollection('levels'),
          getCollection('submissions'),
          getCollection('completions'),
        ])
        setStats({
          users: users.length,
          levels: levels.length,
          pending: submissions.filter(s => s.status === 'pending').length,
          completions: completions.length,
        })
      } catch (err) {
        console.error(err)
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [])

  if (loading || fetching) {
    return (
      <PageShell>
        <div className={styles.loading}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  const cards = [
    { label: 'Total Users', value: stats.users, icon: Users, color: 'var(--accent-blue)', link: '/admin/users' },
    { label: 'Total Levels', value: stats.levels, icon: Layers, color: 'var(--accent-green)', link: '/admin/levels' },
    { label: 'Pending Reviews', value: stats.pending, icon: ListCheck, color: 'var(--accent-gold)', link: '/admin/submissions' },
    { label: 'Completions', value: stats.completions, icon: FileText, color: 'var(--accent-purple)', link: '#' },
  ]

  return (
    <PageShell title="Admin Dashboard" subtitle="Manage the community platform">
      <div className={styles.grid}>
        {cards.map(card => (
          <Link to={card.link} key={card.label} className={styles.cardLink}>
            <Card hover className={styles.statCard}>
              <card.icon size={24} style={{ color: card.color }} />
              <span className={styles.statValue}>{card.value}</span>
              <span className={styles.statLabel}>{card.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      <div className={styles.quickLinks}>
        <h3 className={styles.sectionTitle}>Quick Actions</h3>
        <div className={styles.linksGrid}>
          <Link to="/admin/submissions" className={styles.quickLink}>
            Review Pending Submissions
          </Link>
          <Link to="/admin/levels" className={styles.quickLink}>
            Manage Community Levels
          </Link>
          <Link to="/admin/users" className={styles.quickLink}>
            Manage Users
          </Link>
        </div>
      </div>
    </PageShell>
  )
}
