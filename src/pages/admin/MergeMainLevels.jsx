import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Merge, RefreshCw } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { getMainLevelDuplicates, mergeMainLevelDuplicates } from '../../services/mainLevels'
import { hasAccess } from '../../utils/constants'
import styles from './Admin.module.css'

export default function MergeMainLevels() {
  const { user, userData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [merging, setMerging] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!authLoading && (!user || !hasAccess(userData?.role || 'user', 'admin'))) navigate('/')
  }, [user, userData, authLoading, navigate])

  const load = async () => {
    setLoading(true)
    setMessage('')
    try {
      const data = await getMainLevelDuplicates()
      setGroups(data)
      if (data.length === 0) setMessage('No duplicate main levels found.')
    } catch (err) {
      console.error(err)
      setMessage('Failed to scan duplicates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasAccess(userData?.role || 'user', 'admin')) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData])

  const handleMerge = async () => {
    if (!confirm('Merge duplicate main levels? Completions will be re-pointed to the kept level.')) return
    setMerging(true)
    setMessage('')
    try {
      const results = await mergeMainLevelDuplicates()
      setMessage(`Merged ${results.length} group(s).`)
      await load()
    } catch (err) {
      console.error(err)
      setMessage('Merge failed.')
    } finally {
      setMerging(false)
    }
  }

  if (authLoading) {
    return <PageShell><div className={styles.loading}><Spinner size="lg" /></div></PageShell>
  }

  return (
    <PageShell title="Merge Duplicate Main Levels" subtitle="Fix levels that exist under multiple document IDs">
      <Card padding="md" className={styles.formCard}>
        <div className={styles.formActions}>
          <Button variant="secondary" size="sm" onClick={load} icon={RefreshCw}>
            Rescan
          </Button>
          <Button variant="primary" size="sm" onClick={handleMerge} loading={merging} icon={Merge}>
            Merge All
          </Button>
        </div>
        {message && <p className="infoPanel">{message}</p>}
      </Card>

      {loading ? (
        <div className={styles.loading}><Spinner size="lg" /></div>
      ) : groups.length === 0 ? (
        <Card padding="lg" className={styles.emptyCard}>
          <p>No duplicate main levels.</p>
        </Card>
      ) : (
        <div className={styles.submissionsList}>
          {groups.map((group, gi) => (
            <Card key={gi} padding="md" className={styles.submissionCard}>
              <div className={styles.subHeader}>
                <div className={styles.subInfo}>
                  <span className={styles.subLevel}>{group[0].name}</span>
                  <span className={styles.subUser}>{group.length} docs</span>
                </div>
              </div>
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <span>ID</span>
                  <span>Position</span>
                  <span>Points</span>
                  <span>Victories</span>
                </div>
                {group.map(l => (
                  <div key={l.id} className={styles.tableRow}>
                    <span className={styles.gameId}>{l.id}</span>
                    <span className={styles.position}>#{l.position || '—'}</span>
                    <span className={styles.points}>{l.points || 0}</span>
                    <span className={styles.creator}>{l.victoryCount || 0}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  )
}