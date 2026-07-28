import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, RotateCcw } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import { getCollection, where } from '../services/firestore'
import { syncMainLevels } from '../services/cache'
import { formatNumber } from '../utils/format'
import { DIFFICULTY_COLORS } from '../utils/constants'
import styles from './List.module.css'

export default function MainList() {
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const loadLevels = async () => {
    setLoading(true)
    try {
      const data = await getCollection('levels', [
        where('type', '==', 'main'),
      ])
      setLevels(data.sort((a, b) => a.position - b.position))
    } catch (err) {
      console.error('Failed to load levels:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLevels()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncMainLevels(true)
      await loadLevels()
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setSyncing(false)
    }
  }

  const diffColor = (diff) => DIFFICULTY_COLORS[diff?.toLowerCase()] || '#ffffff'

  return (
    <PageShell title="Main Demon List" subtitle="Official Geometry Dash demon levels from the Global Demon List">
      <div className={styles.toolbar}>
        <span className={styles.count}>{levels.length} levels</span>
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={handleSync} loading={syncing}>
          Sync
        </Button>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span className={styles.colPos}>#</span>
            <span className={styles.colName}>Level</span>
            <span className={styles.colDiff}>Difficulty</span>
            <span className={styles.colPoints}>Points</span>
            <span className={styles.colVerifier}>Verifier</span>
            <span className={styles.colPlayers}>Players</span>
          </div>

          {levels.map((level, i) => (
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
                  {level.thumbnail && (
                    <img src={level.thumbnail} alt="" className={styles.thumbnail} />
                  )}
                  <div>
                    <span className={styles.levelName}>{level.name}</span>
                    <span className={styles.creator}>by {level.creator}</span>
                  </div>
                </div>
              </span>
              <span className={styles.colDiff}>
                <Badge variant="default" size="sm" style={{ color: diffColor(level.difficulty), borderColor: diffColor(level.difficulty) }}>
                  {level.difficulty}
                </Badge>
              </span>
              <span className={styles.colPoints}>
                <span className={styles.points}>{formatNumber(level.points)}</span>
              </span>
              <span className={styles.colVerifier}>
                <span className={styles.verifier}>{level.verifier}</span>
              </span>
              <span className={styles.colPlayers}>
                <span className={styles.players}>{formatNumber(level.players)}</span>
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
