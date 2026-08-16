import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListCheck, Users, Layers, FileText, Flag, Wrench, Tag } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { getCollection } from '../../services/firestore'
import { hasAccess } from '../../utils/constants'
import styles from './Admin.module.css'

export default function AdminDashboard() {
  const { user, userData, loading } = useAuth()
  const { maintenance, loading: configLoading } = useSiteConfig()
  const navigate = useNavigate()
  const role = userData?.role || 'user'
  const [stats, setStats] = useState({ users: 0, levels: 0, pending: 0, completions: 0 })
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && (!user || !hasAccess(role, 'admin'))) {
      navigate('/')
    }
  }, [user, role, loading, navigate])

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
      {!configLoading && (
        <Link to="/admin/settings" className={styles.statusLink}>
          <Card className={styles.statusCard}>
            <Wrench size={18} style={{ color: maintenance ? 'var(--accent-red)' : 'var(--accent-green)' }} />
            <span>
              Maintenance mode is{' '}
              <strong style={{ color: maintenance ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                {maintenance ? 'ENABLED' : 'DISABLED'}
              </strong>
            </span>
            <span className={styles.statusEdit}>Edit settings →</span>
          </Card>
        </Link>
      )}

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
          <Link to="/admin/submissions" className={styles.quickLink}>
            Level Acceptance
          </Link>
          <Link to="/admin/levels" className={styles.quickLink}>
            Manage Community Levels
          </Link>
          <Link to="/admin/users" className={styles.quickLink}>
            Manage Users
          </Link>
          {role === 'owner' && (
            <Link to="/admin/reports" className={styles.quickLink}>
              <Flag size={16} /> User Reports
            </Link>
          )}
          <Link to="/admin/settings" className={styles.quickLink}>
            <Wrench size={16} /> Site Settings
          </Link>
          <Link to="/admin/tags" className={styles.quickLink}>
            <Tag size={16} /> Manage Tags
          </Link>
          <Link to="/admin/merge" className={styles.quickLink}>
            <Layers size={16} /> Merge Duplicate Levels
          </Link>
        </div>
      </div>
    </PageShell>
  )
}
