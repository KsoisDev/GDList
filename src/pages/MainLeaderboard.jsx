import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle2, Crown, Trophy, Medal, Users } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import ThemedPageHero from '../components/layout/ThemedPageHero'
import Avatar from '../components/ui/Avatar'
import SearchBar from '../components/ui/SearchBar'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { loadUsers } from '../services/readCache'
import { formatNumber, getDisplayName } from '../utils/format'
import { getFlagUrl } from '../utils/countries'
import { useLanguage } from '../hooks/useLanguage'
import styles from './Leaderboard.module.css'
import theme from '../components/layout/ThemedPage.module.css'

export default function MainLeaderboard() {
  const { t } = useLanguage()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const users = await loadUsers()
        const sorted = users
          .filter(u => (u.stats?.mainPoints || 0) > 0)
          .sort((a, b) => (b.stats?.mainPoints || 0) - (a.stats?.mainPoints || 0))
          .slice(0, 100)
          .map((player, index) => ({
            ...player,
            stats: {
              ...player.stats,
              mainCompletions: player.stats?.mainCompletions || 0,
            },
            _rank: index + 1,
          }))
        setPlayers(sorted)
      } catch (err) {
        console.error('Failed to load leaderboard:', err)
        setLoadError('leader.mainLoadFailed')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryKey])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return players
    return players.filter(p =>
      p.username?.toLowerCase().includes(q) ||
      p.displayName?.toLowerCase().includes(q)
    )
  }, [players, search])

  const getRankIcon = (pos) => {
    if (pos === 0) return <Trophy size={20} style={{ color: 'var(--accent-gold)' }} aria-hidden="true" />
    if (pos === 1) return <Medal size={20} style={{ color: '#c0c0c0' }} aria-hidden="true" />
    if (pos === 2) return <Medal size={20} style={{ color: '#cd7f32' }} aria-hidden="true" />
    return null
  }

  return (
    <PageShell className={theme.pageShell}>
      <div className={theme.glow} aria-hidden="true" />
      <ThemedPageHero
        eyebrow={t('leader.mainEyebrow')}
        title={t('leader.mainTitle')}
        accentTitle={t('leader.mainAccent')}
        description={t('leader.mainDescription')}
        actions={[
          { to: '/submit', label: t('leader.submitRecord') },
          { to: '/leaderboard/community', label: t('leader.communityRankings') },
        ]}
        stats={[
          { icon: Users, value: loading ? '—' : players.length, label: t('leader.rankedPlayers') },
          { icon: CheckCircle2, value: loading ? '—' : players.reduce((sum, player) => sum + (player.stats?.mainCompletions || 0), 0), label: t('leader.countedClears') },
          { icon: Crown, value: loading ? t('common.loading') : players[0] ? getDisplayName(players[0]) : t('common.unranked'), label: t('leader.currentLeader'), featured: true },
        ]}
      />

      <section className={theme.surface} aria-label={t('nav.mainRankings')}>
        <div className={theme.surfaceHeading}>
          <div>
            <span className={theme.sectionLabel}>{t('leader.live')}</span>
            <h2>{t('leader.standings')}</h2>
          </div>
          <span className={theme.count}>{filtered.length} {filtered.length === 1 ? t('common.player') : t('common.playersLower')}</span>
        </div>

      <div className={styles.toolbar}>
        <span className={styles.count}>{filtered.length} {t('common.playersLower')}</span>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t('leader.searchPlaceholder')}
          className={styles.searchBar}
        />
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      ) : loadError ? (
        <div className={styles.errorState} role="alert">
          <p>{t(loadError)}</p>
          <Button variant="secondary" size="sm" onClick={() => setRetryKey(key => key + 1)}>{t('common.tryAgain')}</Button>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span className={styles.colRank}>{t('common.rank')}</span>
            <span className={styles.colPlayer}>{t('common.playerLabel')}</span>
            <span className={styles.colPoints}>{t('common.points')}</span>
            <span className={styles.colCompletions}>{t('common.completions')}</span>
          </div>

          {filtered.map((player, i) => (
            <motion.div
              key={player.id}
              className={styles.tableRow}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.02 }}
            >
              <span className={styles.colRank}>
                <span className={styles.rank}>
                  <span className={styles.rankA11y}>{t('leader.rankLabel', { rank: player._rank })}</span>
                  <span aria-hidden="true">{getRankIcon(player._rank - 1) || `#${player._rank}`}</span>
                </span>
              </span>
              <span className={styles.colPlayer}>
                <Link to={`/profile/${player.id}`} className={styles.playerInfo}>
                  <Avatar src={player.avatarURL} alt={getDisplayName(player)} size="sm" />
                  <span className={styles.username}>{getDisplayName(player)}</span>
                  {player.role === 'owner' && <span className={`${styles.roleBadge} ${styles.roleOwner}`}>Owner</span>}
                  {player.role === 'admin' && <span className={`${styles.roleBadge} ${styles.roleAdmin}`}>Admin</span>}
                  {player.isDeveloper && <span className={`${styles.roleBadge} ${styles.roleDev}`}>Dev</span>}
                  {getFlagUrl(player.country) && (
                    <img src={getFlagUrl(player.country)} alt={player.country} className={styles.flagImg} loading="lazy" />
                  )}
                </Link>
              </span>
              <span className={styles.colPoints}>
                <span className={styles.points}>{formatNumber(player.stats?.mainPoints || 0)}</span>
              </span>
              <span className={styles.colCompletions}>
                <span className={styles.completions}>{player.stats?.mainCompletions || 0}</span>
              </span>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className={styles.empty}>
              {search
                ? <p>{t('leader.noMatches', { search })}</p>
                : <p>{t('leader.noMainPoints')}</p>}
            </div>
          )}
        </div>
      )}
      </section>
    </PageShell>
  )
}
