import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Trophy, Medal } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Avatar from '../components/ui/Avatar'
import SearchBar from '../components/ui/SearchBar'
import Spinner from '../components/ui/Spinner'
import { getCollection, where } from '../services/firestore'
import { computeUserCommunityPoints } from '../services/communityList'
import { formatNumber } from '../utils/format'
import styles from './Leaderboard.module.css'

export default function CommunityLeaderboard() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [users, comps, levels] = await Promise.all([
          getCollection('users'),
          getCollection('completions'),
          getCollection('levels', [where('type', '==', 'community')]),
        ])
        const pointsMap = {}
        levels.forEach(l => { pointsMap[l.id] = l.position })
        const { totals, counts } = computeUserCommunityPoints(comps, pointsMap)

        const sorted = users
          .map(u => ({
            ...u,
            liveCommunityPoints: totals[u.id] || 0,
            liveCount: counts[u.id] || 0,
          }))
          .filter(u => u.liveCommunityPoints > 0)
          .sort((a, b) => b.liveCommunityPoints - a.liveCommunityPoints)
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return players
    return players.filter(p =>
      p.username?.toLowerCase().includes(q) ||
      p.displayName?.toLowerCase().includes(q)
    )
  }, [players, search])

  const getRankIcon = (pos) => {
    if (pos === 0) return <Trophy size={20} style={{ color: 'var(--accent-gold)' }} />
    if (pos === 1) return <Medal size={20} style={{ color: '#c0c0c0' }} />
    if (pos === 2) return <Medal size={20} style={{ color: '#cd7f32' }} />
    return null
  }

  return (
    <PageShell title="Community Leaderboard" subtitle="Top players ranked by points from community demon completions">
      <div className={styles.toolbar}>
        <span className={styles.count}>{filtered.length} players</span>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search player..."
          className={styles.searchBar}
        />
      </div>

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

          {filtered.map((player, i) => (
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
                <span className={styles.points}>{formatNumber(player.liveCommunityPoints)}</span>
              </span>
              <span className={styles.colCompletions}>
                <span className={styles.completions}>{player.liveCount}</span>
              </span>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className={styles.empty}>
              {search
                ? <p>No players match "{search}".</p>
                : <p>No community points yet. Submit your first completion!</p>}
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}
