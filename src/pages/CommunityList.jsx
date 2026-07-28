import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageShell from '../components/layout/PageShell'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { getCollection, where } from '../services/firestore'
import { formatDate } from '../utils/format'
import { DIFFICULTY_COLORS } from '../utils/constants'
import styles from './List.module.css'

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'unverified', label: 'Levels to Verify' },
]

export default function CommunityList() {
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')

  useEffect(() => {
    async function load() {
      try {
        const data = await getCollection('levels', [
          where('type', '==', 'community'),
        ])
        setLevels(data.sort((a, b) => a.position - b.position))
      } catch (err) {
        console.error('Failed to load community levels:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const active = levels.filter(l => (l.victoryCount || 0) > 0)
  const unverified = levels.filter(l => (l.victoryCount || 0) === 0)

  const diffColor = (diff) => DIFFICULTY_COLORS[diff?.toLowerCase()] || '#ffffff'

  return (
    <PageShell title="Community Demon List" subtitle="Levels created and verified by our community members">
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {tab === 'active' ? active.length : unverified.length} levels
        </span>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      ) : tab === 'active' && active.length === 0 ? (
        <Card padding="lg" className={styles.empty}>
          <p>No active community levels yet. Levels appear here once they have at least one completion.</p>
        </Card>
      ) : tab === 'unverified' && unverified.length === 0 ? (
        <Card padding="lg" className={styles.empty}>
          <p>No unverified levels. New level submissions will appear here once approved by an admin.</p>
        </Card>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span className={styles.colPos}>#</span>
            <span className={styles.colName}>Level</span>
            <span className={styles.colDiff}>Difficulty</span>
            {tab === 'active' && <span className={styles.colPoints}>Points</span>}
            <span className={styles.colVerifier}>Creators</span>
            <span className={styles.colCreator}>Submitter</span>
          </div>

          {(tab === 'active' ? active : unverified).map((level, i) => (
            <motion.div
              key={level.id}
              className={styles.tableRow}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <span className={styles.colPos}>
                <span className={styles.position}>#{level.position}</span>
              </span>
              <span className={styles.colName}>
                <div className={styles.levelInfo}>
                  <div>
                    {tab === 'active' ? (
                      <Link to={`/levels/${level.id}`} className={styles.levelLink}>
                        <span className={styles.levelName}>{level.name}</span>
                      </Link>
                    ) : (
                      <span className={styles.levelName}>{level.name}</span>
                    )}
                    <span className={styles.creator}>by {level.creator}</span>
                  </div>
                </div>
              </span>
              <span className={styles.colDiff}>
                <Badge variant="default" size="sm" style={{ color: diffColor(level.difficulty), borderColor: diffColor(level.difficulty) }}>
                  {level.difficulty}
                </Badge>
              </span>
              {tab === 'active' && (
                <span className={styles.colPoints}>
                  <span className={styles.points}>{level.points}</span>
                </span>
              )}
              <span className={styles.colVerifier}>
                <span className={styles.verifier}>{level.creator}</span>
              </span>
              <span className={styles.colCreator}>
                <span className={styles.creator}>—</span>
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
