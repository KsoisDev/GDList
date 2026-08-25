import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Crown,
  Flame,
  Layers3,
  List,
  Music,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  Users,
  Youtube,
} from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import { useAuth } from '../hooks/useAuth'
import { loadUsers, loadCommunityLevels } from '../services/readCache'
import { getCollection, where, query, orderBy, limit } from '../services/firestore'
import { formatDateRelative, formatNumber, getDisplayName } from '../utils/format'
import { getFlagUrl } from '../utils/countries'
import styles from './Home.module.css'

const communityBenefits = [
  {
    icon: Layers3,
    title: 'Two lists, one community',
    description: 'Track official demons and the levels created inside the Basement community.',
  },
  {
    icon: ShieldCheck,
    title: 'Records with proof',
    description: 'Every submitted completion includes video evidence and a clear review status.',
  },
  {
    icon: Trophy,
    title: 'Rankings that feel earned',
    description: 'Climb separate main and community leaderboards as your completion history grows.',
  },
]

const emptyHighlights = {
  topMain: [],
  topCommunity: [],
  recent: [],
  newLevels: [],
  communityLevels: [],
  stats: { users: 0, records: 0, levels: 0 },
}

export default function Home() {
  const { user } = useAuth()
  const [highlights, setHighlights] = useState(emptyHighlights)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setLoadError('')

    Promise.allSettled([
      loadUsers(),
      loadCommunityLevels(),
      getCollection('completions', [
        where('levelType', '==', 'community'),
        orderBy('completedAt', 'desc'),
        limit(4),
      ]),
    ])
      .then(([usersResult, communityLevelsResult, recentResult]) => {
        const users = usersResult.status === 'fulfilled' ? usersResult.value : []
        const communityLevels = communityLevelsResult.status === 'fulfilled' ? communityLevelsResult.value : []
        const recentCompletions = recentResult.status === 'fulfilled' ? recentResult.value : []

        const usersById = Object.fromEntries(users.map(u => [u.id, u]))

        const topMain = users
          .filter(u => (u.stats?.mainPoints || 0) > 0)
          .sort((a, b) => (b.stats?.mainPoints || 0) - (a.stats?.mainPoints || 0))
          .slice(0, 3)

        const topCommunity = users
          .filter(u => (u.stats?.communityPoints || 0) > 0)
          .sort((a, b) => (b.stats?.communityPoints || 0) - (a.stats?.communityPoints || 0))
          .slice(0, 3)

        const recent = recentCompletions.map(c => ({
          ...c,
          username: usersById[c.userId]
            ? getDisplayName(usersById[c.userId])
            : c.username || 'A community player',
        }))

        const levelTime = level => (
          level.createdAt?.toMillis?.()
          || level.victors?.[0]?.completedAt?.toMillis?.()
          || level.firstCompletedAt?.toMillis?.()
          || 0
        )
        const newLevels = communityLevels
          .sort((a, b) => levelTime(b) - levelTime(a))
          .slice(0, 3)
        const rankedLevels = communityLevels
          .filter(level => (level.position || 0) > 0)
          .sort((a, b) => (a.position || Number.MAX_SAFE_INTEGER) - (b.position || Number.MAX_SAFE_INTEGER))
          .slice(0, 5)

        if (mounted) {
          setHighlights({
            topMain,
            topCommunity,
            recent,
            newLevels,
            communityLevels: rankedLevels,
            stats: {
              users: users.length,
              records: users.reduce((sum, u) => sum + (u.stats?.communityCompletions || 0), 0),
              levels: communityLevels.length,
            },
          })
          const partialFailure = [usersResult, communityLevelsResult, recentResult]
            .some(result => result.status === 'rejected')
          setLoadError(partialFailure ? 'Some live community data could not be loaded.' : '')
        }
      })
      .catch(error => {
        console.error('Failed to load home data:', error)
        if (mounted) setLoadError('Live community data could not be loaded.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [retryKey])

  const activity = useMemo(() => {
    const records = highlights.recent.map(record => ({
      id: `record-${record.id}`,
      type: 'record',
      title: record.username,
      text: `completed ${record.levelName || 'a demon'}`,
      time: formatDateRelative(record.completedAt || record.createdAt),
      href: record.levelId ? `/levels/${record.levelId}` : '/list/community',
    }))
    const levels = highlights.newLevels.map(level => ({
      id: `level-${level.id}`,
      type: 'level',
      title: level.name,
      text: `joined the community list · by ${level.creator || 'Unknown'}`,
      time: formatDateRelative(level.createdAt || level.firstCompletedAt),
      href: `/levels/${level.id}`,
    }))

    return [...records, ...levels].slice(0, 5)
  }, [highlights])

  const statItems = [
    { icon: Users, value: highlights.stats.users, label: 'Players' },
    { icon: Trophy, value: highlights.stats.records, label: 'Records' },
    { icon: List, value: highlights.stats.levels, label: 'Levels' },
  ]
  const previewLevels = highlights.communityLevels
  const activeListHref = '/list/community'

  return (
    <main id="main-content" className={styles.page} tabIndex={-1}>
      <div className={styles.ambientGlow} aria-hidden="true" />
      <div className={styles.sceneLines} aria-hidden="true" />
      <div className={styles.depthMarker} aria-hidden="true">
        <span>01</span><span>02</span><span>03</span><span>04</span>
      </div>

      <section className={styles.hero}>
        <motion.div
          className={styles.heroContent}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <div className={styles.eyebrow}>
            <Radio size={14} />
            <span>THE TNAILLZXGD COMMUNITY LIST</span>
          </div>

          <h1 className={styles.heroTitle}>
            The Basement<br />
            <span>Demon List</span>
          </h1>

          <p className={styles.heroSubtitle}>
            A community-built ranking for Geometry Dash players who want to prove their runs,
            discover their next challenge, and climb together.
          </p>

          <div className={styles.stats} aria-label="Community statistics">
            {statItems.map(({ icon: Icon, value, label }) => (
              <div className={styles.stat} key={label}>
                <Icon size={17} aria-hidden="true" />
                <strong className={loading ? styles.loadingValue : ''}>
                  {loading ? '—' : formatNumber(value)}
                </strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} to="/list/community">
              Explore the list <ArrowRight size={17} />
            </Link>
            <Link className={styles.secondaryAction} to="/submit">
              Submit a record <Trophy size={17} />
            </Link>
            <Link className={styles.secondaryAction} to="/submit-level">
              Submit a level <Upload size={17} />
            </Link>
          </div>

          <div className={styles.socialLinks} aria-label="Community social links">
            <a href="https://discord.gg/75FaX3gmM2" target="_blank" rel="noopener noreferrer">
              <Users size={14} /> Discord
            </a>
            <a href="https://www.tiktok.com/@tnaillzgd" target="_blank" rel="noopener noreferrer">
              <Music size={14} /> TikTok
            </a>
            <a href="https://www.youtube.com/@tNaiLLzxGd" target="_blank" rel="noopener noreferrer">
              <Youtube size={14} /> YouTube
            </a>
          </div>
          {loadError && (
            <div className={styles.dataNotice} role="alert">
              <span>{loadError}</span>
              <button type="button" onClick={() => setRetryKey(key => key + 1)}>Try again</button>
            </div>
          )}
        </motion.div>

        <motion.aside
          className={styles.listSpotlight}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.16, duration: 0.55, ease: 'easeOut' }}
          aria-label="List preview"
        >
          <div className={styles.spotlightTopline}>
            <div>
              <span className={styles.liveDot} />
              <span>CURRENT RANKING</span>
            </div>
            <Link to={activeListHref}>Open full list <ArrowRight size={14} /></Link>
          </div>

          <div className={styles.previewList}>
            {loading && [0, 1, 2, 3, 4].map(item => (
              <div className={styles.previewSkeleton} key={item} />
            ))}

            {!loading && previewLevels.map(level => (
              <Link className={styles.previewRow} to={`/levels/${level.id}`} key={level.id}>
                <span className={styles.previewRank}>#{level.position}</span>
                <span className={styles.previewName}>
                  <strong>{level.name}</strong>
                  <small>by {level.creator || 'Unknown'}</small>
                </span>
                <span className={styles.previewPoints}>{formatNumber(level.points || 0)} pts</span>
                <ChevronRight size={15} />
              </Link>
            ))}

            {!loading && previewLevels.length === 0 && (
              <div className={styles.previewEmpty}>
                <List size={20} />
                <strong>Community list</strong>
                <span>Ranked levels will appear here as soon as the database is connected.</span>
              </div>
            )}
          </div>

          <Link className={styles.spotlightFooter} to={activeListHref}>
            Browse every community level
            <ArrowRight size={15} />
          </Link>
        </motion.aside>
      </section>

      <section className={styles.dashboard} aria-label="Community overview">
        <motion.article
          className={`${styles.panel} ${styles.activityPanel}`}
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
        >
          <header className={styles.panelHeader}>
            <div>
              <Activity size={18} />
              <h2>Recent activity</h2>
            </div>
            <Link to="/list/community">View all <ArrowRight size={14} /></Link>
          </header>

          <div className={styles.activityList}>
            {loading && [0, 1, 2, 3].map(item => (
              <div className={styles.activitySkeleton} key={item} />
            ))}

            {!loading && activity.map(item => (
              <Link className={styles.activityRow} to={item.href} key={item.id}>
                <span className={`${styles.activityIcon} ${item.type === 'record' ? styles.recordIcon : styles.levelIcon}`}>
                  {item.type === 'record' ? <Flame size={15} /> : <Upload size={15} />}
                </span>
                <span className={styles.activityCopy}>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </span>
                <time>{item.time || 'Recently'}</time>
              </Link>
            ))}

            {!loading && activity.length === 0 && (
              <div className={styles.emptyActivity}>
                <Sparkles size={18} />
                <span>The next verified record will appear here.</span>
              </div>
            )}
          </div>
        </motion.article>

        <motion.aside
          className={`${styles.panel} ${styles.whyPanel}`}
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          viewport={{ once: true, margin: '-60px' }}
        >
          <header className={styles.panelHeader}>
            <div>
              <CheckCircle2 size={18} />
              <h2>Why Basement List?</h2>
            </div>
          </header>

          <div className={styles.benefitList}>
            {communityBenefits.map(({ icon: Icon, title, description }) => (
              <div className={styles.benefit} key={title}>
                <span><Icon size={18} /></span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.aside>
      </section>

      {!loading && (
        <section className={styles.leaderboards} aria-label="Top player rankings">
          <article className={styles.leaders}>
            <div className={styles.leadersHeading}>
              <div>
                <Crown size={18} />
                <span>Main List leaders</span>
              </div>
              <Link to="/leaderboard/main">Full leaderboard <ArrowRight size={14} /></Link>
            </div>
            <div className={styles.leaderList}>
              {highlights.topMain.map((player, index) => (
                <Link className={styles.leader} to={`/profile/${player.id}`} key={player.id}>
                  <span className={styles.leaderRank}>#{index + 1}</span>
                  <Avatar src={player.avatarURL} alt={getDisplayName(player)} size="sm" />
                  <strong>{getDisplayName(player)}</strong>
                  {getFlagUrl(player.country) && (
                    <img src={getFlagUrl(player.country)} alt={player.country} loading="lazy" />
                  )}
                  <span>{formatNumber(player.stats?.mainPoints || 0)} pts</span>
                </Link>
              ))}
              {highlights.topMain.length === 0 && (
                <p className={styles.leaderEmpty}>Main rankings are temporarily unavailable.</p>
              )}
            </div>
          </article>

          <article className={styles.leaders}>
            <div className={styles.leadersHeading}>
              <div>
                <Crown size={18} />
                <span>Community List leaders</span>
              </div>
              <Link to="/leaderboard/community">Full leaderboard <ArrowRight size={14} /></Link>
            </div>
            <div className={styles.leaderList}>
              {highlights.topCommunity.map((player, index) => (
                <Link className={styles.leader} to={`/profile/${player.id}`} key={player.id}>
                  <span className={styles.leaderRank}>#{index + 1}</span>
                  <Avatar src={player.avatarURL} alt={getDisplayName(player)} size="sm" />
                  <strong>{getDisplayName(player)}</strong>
                  {getFlagUrl(player.country) && (
                    <img src={getFlagUrl(player.country)} alt={player.country} loading="lazy" />
                  )}
                  <span>{formatNumber(player.livePoints || 0)} pts</span>
                </Link>
              ))}
              {highlights.topCommunity.length === 0 && (
                <p className={styles.leaderEmpty}>Community rankings are temporarily unavailable.</p>
              )}
            </div>
          </article>
        </section>
      )}

      <section className={styles.finalCta}>
        <div>
          <span>READY FOR YOUR NEXT DEMON?</span>
          <h2>Make your run part of the list.</h2>
        </div>
        <div>
          <Link className={styles.primaryAction} to={user ? '/submit' : '/register'}>
            {user ? 'Submit a record' : 'Create an account'} <ArrowRight size={17} />
          </Link>
          <Link className={styles.textAction} to={user ? '/profile' : '/login'}>
            {user ? 'My profile' : 'Sign in'}
          </Link>
        </div>
      </section>
    </main>
  )
}
