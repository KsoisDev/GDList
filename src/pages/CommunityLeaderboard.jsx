import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Trophy, Medal } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Avatar from '../components/ui/Avatar'
import Spinner from '../components/ui/Spinner'
import { getCollection } from '../services/firestore'
import { formatNumber } from '../utils/format'
import styles from './Leaderboard.module.css'

export default function CommunityLeaderboard() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await getCollection('users')
        const sorted = data
          .filter(u => (u.stats?.communityPoints || 0) > 0)
          .sort((a, b) => (b.stats?.communityPoints || 0) - (a.stats?.communityPoints || 0))
          .slice(0, 100)
        setPlayers(sorted)
      } catch (err) {
        console.error('Failed to load community leaderboard:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const getRankIcon = (pos) => {
    if (pos === 0) return <Trophy size={20} style={{ color: 'var(--accent-gold)' }} />
    if (pos === 1) return <Medal size={20} style={{ color: '#c0c0c0' }} />
    if (pos === 2) return <Medal size={20} style={{ color: '#cd7f32' }} />
    return null
  }

  return (
    <PageShell title="Community Leaderboard" subtitle="Top players ranked by points from community demon completions">
      {loading ? (
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span className={styles.colRank}>Rank</span>
            <span className={styles.colPlayer}>Player</span>
            <span className={styles.colPoints}>Points</span>
            <span className={styles.colCompletions}>Completions</span>
          </div>

          {players.map((player, i) => (
            <motion.div
              key={player.id}
              className={styles.tableRow}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <span className={styles.colRank}>
                <span className={styles.rank}>
                  {getRankIcon(i) || `#${i + 1}`}
                </span>
              </span>
              <span className={styles.colPlayer}>
                <Link to={`/profile/${player.id}`} className={styles.playerInfo}>
                  <Avatar src={player.avatarURL} alt={player.username} size="sm" />
                  <span className={styles.username}>{player.username}</span>
                </Link>
              </span>
              <span className={styles.colPoints}>
                <span className={styles.points}>{formatNumber(player.stats?.communityPoints || 0)}</span>
              </span>
              <span className={styles.colCompletions}>
                <span className={styles.completions}>{player.stats?.communityCompletions || 0}</span>
              </span>
            </motion.div>
          ))}

          {players.length === 0 && (
            <div className={styles.empty}>
              <p>No community points yet. Submit your first completion!</p>
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}
