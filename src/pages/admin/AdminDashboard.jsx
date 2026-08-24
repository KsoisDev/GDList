import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListCheck, Users, Layers, FileText, Flag, Wrench, Tag, RefreshCw, UserCog } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { getCollection } from '../../services/firestore'
import { syncMainLevelsFromAredl } from '../../services/mainLevels'
import { recalcAllUsersPoints } from '../../services/recalcUserPoints'
import { hasAccess } from '../../utils/constants'
import styles from './Admin.module.css'

export default function AdminDashboard() {
  const { user, userData, loading } = useAuth()
  const { maintenance, loading: configLoading } = useSiteConfig()
  const navigate = useNavigate()
  const role = userData?.role || 'user'
  const [stats, setStats] = useState({ users: 0, levels: 0, pending: 0, completions: 0 })
  const [fetching, setFetching] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcMessage, setRecalcMessage] = useState('')
  const [recalcError, setRecalcError] = useState(false)

  const handleSync = async () => {
    if (syncing) return
    if (!confirm('Update position and points of all existing main-list levels from AREDL? Only existing levels are updated, nothing is created or deleted.')) return
    setSyncing(true)
    setSyncMessage('')
    setSyncError(false)
    try {
      const result = await syncMainLevelsFromAredl()
      if (result.unmatched.length > 0) {
        const shown = result.unmatched.slice(0, 8).map(u => u.name).join(', ')
        const extra = result.unmatched.length > 8 ? ` +${result.unmatched.length - 8} more` : ''
        setSyncMessage(`Updated ${result.updated} of ${result.total} main levels with AREDL positions/points. ${result.unmatched.length} without match (kept as-is): ${shown}${extra}.`)
      } else {
        setSyncMessage(`Updated all ${result.updated} main levels with AREDL positions/points.`)
      }
    } catch (err) {
      console.error(err)
      setSyncError(true)
      setSyncMessage('Sync failed: ' + (err.message || err))
    } finally {
      setSyncing(false)
    }
  }

  const handleRecalcUsers = async () => {
    if (recalculating) return
    if (!confirm("Recalculate all user points? This refreshes completion points from their current level values, removes duplicate completions (keeps the oldest), refreshes player names/countries/photos in rankings, and rewrites every user's stats.")) return
    setRecalculating(true)
    setRecalcMessage('')
    setRecalcError(false)
    try {
      const r = await recalcAllUsersPoints()
      setRecalcMessage(`Done: ${r.usersUpdated} of ${r.usersChecked} users updated · ${r.completionsRefreshed} completions refreshed · ${r.duplicatesRemoved} duplicates removed (of ${r.completionsTotal}) · ${r.snapshotsUpdated} level snapshots refreshed.`)
    } catch (err) {
      console.error(err)
      setRecalcError(true)
      setRecalcMessage('Recalc failed: ' + (err.message || err))
    } finally {
      setRecalculating(false)
    }
  }

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
          {hasAccess(role, 'owner') && (
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
          <button
            type="button"
            className={styles.quickLink}
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw size={16} className={syncing ? styles.syncingSpin : ''} />
            {syncing ? 'Syncing Main List...' : 'Sync Main List from AREDL'}
          </button>
          <button
            type="button"
            className={styles.quickLink}
            onClick={handleRecalcUsers}
            disabled={recalculating}
          >
            <UserCog size={16} className={recalculating ? styles.syncingSpin : ''} />
            {recalculating ? 'Recalculating Points...' : 'Sync Users Points'}
          </button>
        </div>
        {syncMessage && (
          <p className={styles.error} style={{ marginTop: 16, color: syncError ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {syncMessage}
          </p>
        )}
        {recalcMessage && (
          <p className={styles.error} style={{ marginTop: 8, color: recalcError ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {recalcMessage}
          </p>
        )}
      </div>
    </PageShell>
  )
}
