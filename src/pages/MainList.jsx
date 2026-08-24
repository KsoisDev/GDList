import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Badge from '../components/ui/Badge'
import SearchBar from '../components/ui/SearchBar'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { getCollection, where } from '../services/firestore'
import { formatNumber } from '../utils/format'
import { DIFFICULTY_COLORS } from '../utils/constants'
import styles from './List.module.css'

export default function MainList() {
  const { user } = useAuth()
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const data = await getCollection('levels', [where('type', '==', 'main')])
        const withWins = data
          .filter(l => (l.victoryCount || 0) > 0)
          .sort((a, b) => a.position - b.position)
        setLevels(withWins.map((level, index) => ({ ...level, _webRank: index + 1 })))
      } catch (err) {
        console.error('Failed to load levels:', err)
        setLoadError('The main list could not be loaded. Check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryKey])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return levels
    return levels.filter(l =>
      l.name?.toLowerCase().includes(q) ||
      l.creator?.toLowerCase().includes(q)
    )
  }, [levels, search])

  const diffColor = (diff) => DIFFICULTY_COLORS[diff?.toLowerCase()] || '#ffffff'

  return (
    <PageShell title="Main Demon List" subtitle="Levels completed at least once by our community">
      <div className={styles.toolbar}>
        <span className={styles.count}>{filtered.length} levels</span>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search level or creator..."
          className={styles.searchBar}
        />
      </div>

      {loading ? (
        <div className={styles.loading}><Spinner size="lg" /></div>
      ) : loadError ? (
        <div className={styles.empty} role="alert">
          <p>{loadError}</p>
          <Button variant="secondary" size="sm" onClick={() => setRetryKey(key => key + 1)}>Try Again</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          {search
            ? <p>No levels match "{search}".</p>
            : <p>No levels completed yet. Submit your first record!</p>}
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.headerMain}>
            <span className={styles.colWeb}>#Web</span>
            <span className={styles.colOff}>#Official</span>
            <span className={styles.colName}>Level</span>
            <span className={styles.colDiff}>Difficulty</span>
            <span className={styles.colPoints}>Points</span>
            <span className={styles.colCreator}>Creator</span>
            <span className={styles.colVictories}>Victories</span>
          </div>

          {filtered.map((level, i) => {
            const completed = !!user && (level.victors || []).some(v => v.userId === user.uid)
            return (
            <motion.div
              key={level.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.02 }}
            >
              <Link to={`/levels/${level.id}`} className={`${styles.rowMain} ${completed ? styles.completed : ''}`}>
                <span className={styles.colWeb}>
                  <span className={styles.webPos}>#{level._webRank}</span>
                </span>
                <span className={styles.colOff}>
                  <span className={styles.position}>#{level.position}</span>
                </span>
                <span className={styles.colName}>
                  <div className={styles.levelInfo}>
                    <div className={styles.levelInfoText}>
                      <span className={styles.levelNameWrap}>
                        <span className={styles.levelName}>{level.name}</span>
                        {completed && <Trophy size={14} className={styles.completedTrophy} />}
                      </span>
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
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
