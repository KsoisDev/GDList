import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { getCollection } from '../services/firestore'
import { formatNumber } from '../utils/format'
import { DIFFICULTIES, DIFFICULTY_COLORS } from '../utils/constants'
import styles from './List.module.css'

const DIFF_ORDER = ['extreme', 'insane', 'hard', 'medium', 'easy']

export default function MainList() {
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await getCollection('levels')
        const withWins = data
          .filter(l => l.type === 'main' && (l.victoryCount || 0) > 0)
          .sort((a, b) => a.position - b.position)
        setLevels(withWins)
      } catch (err) {
        console.error('Failed to load levels:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const grouped = {}
  DIFF_ORDER.forEach(d => { grouped[d] = [] })
  levels.forEach(l => {
    const key = l.difficulty?.toLowerCase()
    if (grouped[key]) grouped[key].push(l)
  })

  const diffColor = (diff) => DIFFICULTY_COLORS[diff?.toLowerCase()] || '#ffffff'

  if (loading) {
    return (
      <PageShell title="Main Demon List" subtitle="Levels completed at least once by our community">
        <div className={styles.loading}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Main Demon List" subtitle="Levels completed at least once by our community">
      <div className={styles.dualLayout}>
        <div className={styles.diffColumn}>
          <h2 className={styles.columnTitle}>Top by Difficulty</h2>
          {DIFF_ORDER.map(diffId => {
            const diff = DIFFICULTIES.find(d => d.id === diffId)
            const items = grouped[diffId] || []
            if (items.length === 0) return null
            return (
              <div key={diffId} className={styles.diffGroup}>
                <h3 className={styles.diffGroupTitle} style={{ color: diff?.color || '#fff' }}>
                  {diff?.label || diffId}
                </h3>
                {items.map((level, i) => (
                  <motion.div
                    key={level.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Link to={`/levels/${level.id}`} className={styles.diffItem}>
                      <span className={styles.diffItemPos}>#{level.position}</span>
                      <span className={styles.diffItemName}>{level.name}</span>
                      <span className={styles.diffItemPts}>{formatNumber(level.points)} pts</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )
          })}
        </div>

        <div className={styles.rankColumn}>
          <h2 className={styles.columnTitle}>Official Ranking</h2>
          {levels.length === 0 ? (
            <div className={styles.empty}><p>No levels completed yet. Submit your first record!</p></div>
          ) : (
            <div className={styles.table}>
              <div className={styles.tableHeader}>
                <span className={styles.colPos}>#</span>
                <span className={styles.colName}>Level</span>
                <span className={styles.colDiff}>Difficulty</span>
                <span className={styles.colPoints}>Points</span>
                <span className={styles.colCreator}>Creator</span>
                <span className={styles.colVictories}>Victories</span>
              </div>
              {levels.map((level, i) => (
                <motion.div
                  key={level.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <Link to={`/levels/${level.id}`} className={styles.tableRow}>
                    <span className={styles.colPos}>
                      <span className={styles.position}>#{level.position}</span>
                    </span>
                    <span className={styles.colName}>
                      <div className={styles.levelInfo}>
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
                    <span className={styles.colCreator}>
                      <span className={styles.creator}>{level.creator}</span>
                    </span>
                    <span className={styles.colVictories}>
                      <span className={styles.victories}>
                        <Trophy size={14} style={{ color: 'var(--accent-gold)' }} />
                        {formatNumber(level.victoryCount || 0)}
                      </span>
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
