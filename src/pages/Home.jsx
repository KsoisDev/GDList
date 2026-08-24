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
import { getCollection } from '../services/firestore'
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
  recent: [],
  newLevels: [],
  mainLevels: [],
  communityLevels: [],
  stats: { users: 0, records: 0, levels: 0 },
}

export default function Home() {
  const { user } = useAuth()
  const [highlights, setHighlights] = useState(emptyHighlights)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [listMode, setListMode] = useState('main')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setLoadError('')

    Promise.all([
      getCollection('users'),
      getCollection('completions'),
      getCollection('levels'),
    ])
      .then(([users, completions, levels]) => {
        const namesById = Object.fromEntries(users.map(user => [user.id, getDisplayName(user)]))
        const topMain = users
          .filter(user => (user.stats?.mainPoints || 0) > 0)
          .sort((a, b) => (b.stats?.mainPoints || 0) - (a.stats?.mainPoints || 0))
          .slice(0, 3)
        const recent = completions
          .filter(completion => completion.status !== 'rejected')
          .sort((a, b) => {
            const aTime = a.completedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0
            const bTime = b.completedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0
            return bTime - aTime
          })
          .slice(0, 4)
          .map(completion => ({
            ...completion,
            username: namesById[completion.userId] || 'A community player',
          }))
        const levelTime = level => (
          level.createdAt?.toMillis?.()
          || level.victors?.[0]?.completedAt?.toMillis?.()
          || level.firstCompletedAt?.toMillis?.()
          || 0
        )
        const newLevels = levels
          .filter(level => level.type === 'community')
          .sort((a, b) => levelTime(b) - levelTime(a))
          .slice(0, 3)
        const rankedLevels = type => levels
          .filter(level => level.type === type && (level.position || 0) > 0)
          .sort((a, b) => (a.position || Number.MAX_SAFE_INTEGER) - (b.position || Number.MAX_SAFE_INTEGER))
          .slice(0, 5)

        if (mounted) {
          setHighlights({
            topMain,
            recent,
            newLevels,
            mainLevels: rankedLevels('main'),
            communityLevels: rankedLevels('community'),
            stats: {
              users: users.length,
              records: completions.filter(completion => completion.status !== 'rejected').length,
              levels: levels.length,
            },
          })
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
      href: record.levelId ? `/levels/${record.levelId}` : '/list/main',
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
  const previewLevels = listMode === 'main' ? highlights.mainLevels : highlights.communityLevels
  const activeListHref = listMode === 'main' ? '/list/main' : '/list/community'

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
            <Link className={styles.primaryAction} to="/list/main">
              Explore the list <ArrowRight size={17} />
            </Link>
            <Link className={styles.secondaryAction} to="/submit">
              Submit a record <Trophy size={17} />
            </Link>
            <Link className={styles.secondaryAction} to="/list/community">
              Community list <Layers3 size={17} />
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

          <div className={styles.listSwitcher} role="group" aria-label="Choose a list">
            <button
              type="button"
              className={listMode === 'main' ? styles.activeListButton : ''}
              aria-pressed={listMode === 'main'}
              onClick={() => setListMode('main')}
            >
              Main list
            </button>
            <button
              type="button"
              className={listMode === 'community' ? styles.activeListButton : ''}
              aria-pressed={listMode === 'community'}
              onClick={() => setListMode('community')}
            >
              Community
            </button>
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
                <strong>{listMode === 'main' ? 'Main list' : 'Community list'}</strong>
                <span>Ranked levels will appear here as soon as the database is connected.</span>
              </div>
            )}
          </div>

          <Link className={styles.spotlightFooter} to={activeListHref}>
            Browse every {listMode === 'main' ? 'main-list' : 'community'} level
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
            <Link to="/list/main">View all <ArrowRight size={14} /></Link>
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

      {highlights.topMain.length > 0 && (
        <section className={styles.leaders}>
          <div className={styles.leadersHeading}>
            <div>
              <Crown size={18} />
              <span>Players leading the Basement</span>
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
          </div>
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
