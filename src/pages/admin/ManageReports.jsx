import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flag, Check, X } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { getCollection, updateDocument } from '../../services/firestore'
import { formatDateRelative } from '../../utils/format'
import { hasAccess } from '../../utils/constants'
import styles from './Admin.module.css'

export default function ManageReports() {
  const { user, userData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || !hasAccess(userData?.role || 'user', 'owner'))) navigate('/')
  }, [user, userData, authLoading, navigate])

  useEffect(() => {
    async function load() {
      try {
        const data = await getCollection('reports')
        setReports(data.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0
          const tb = b.createdAt?.toMillis?.() || 0
          return tb - ta
        }))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (userData?.role === 'owner') load()
  }, [userData])

  const resolveReport = async (reportId, newStatus) => {
    try {
      await updateDocument('reports', reportId, { status: newStatus })
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r))
    } catch (err) {
      console.error(err)
    }
  }

  if (authLoading || loading) {
    return <PageShell><div className={styles.loading}><Spinner size="lg" /></div></PageShell>
  }

  return (
    <PageShell title="User Reports" subtitle={`${reports.filter(r => r.status === 'open').length} open reports`}>
      {reports.length === 0 ? (
        <Card padding="lg" className={styles.emptyCard}>
          <p>No reports yet.</p>
        </Card>
      ) : (
        <div className={styles.submissionsList}>
          {reports.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.03 }}
            >
              <Card padding="md" className={styles.submissionCard}>
                <div className={styles.subHeader}>
                  <div className={styles.subInfo}>
                    <Flag size={16} style={{ color: 'var(--accent-red)' }} />
                    <Badge variant={r.status === 'open' ? 'gold' : 'default'} size="sm">{r.status}</Badge>
                    <span className={styles.subUser}>Reported by {r.reporterName}</span>
                    <span className={styles.subDate}>{formatDateRelative(r.createdAt)}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Target:</strong> <Link to={`/profile/${r.targetId}`} style={{ color: 'var(--accent-blue)' }}>{r.targetId}</Link>
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  <strong>Reason:</strong> {r.reason}
                </p>
                {r.status === 'open' && (
                  <div className={styles.subActions}>
                    <div className={styles.actionBtns}>
                      <Button variant="primary" size="sm" icon={Check} onClick={() => resolveReport(r.id, 'resolved')}>
                        Resolve
                      </Button>
                      <Button variant="ghost" size="sm" icon={X} onClick={() => resolveReport(r.id, 'dismissed')}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
