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
import { useLanguage } from '../hooks/useLanguage'
import { getCollection } from '../services/firestore'
import { computeUserCommunityPoints } from '../services/communityList'
import { formatDateRelative, formatNumber, getDisplayName } from '../utils/format'
import { getFlagUrl } from '../utils/countries'
import styles from './Home.module.css'

const communityBenefits = [
  {
    icon: Layers3,
    titleKey: 'home.benefitOneTitle',
    descriptionKey: 'home.benefitOneText',
  },
  {
    icon: ShieldCheck,
    titleKey: 'home.benefitTwoTitle',
    descriptionKey: 'home.benefitTwoText',
  },
  {
    icon: Trophy,
    titleKey: 'home.benefitThreeTitle',
    descriptionKey: 'home.benefitThreeText',
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
  const { t } = useLanguage()
  const [highlights, setHighlights] = useState(emptyHighlights)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setLoadError('')

    Promise.allSettled([
      getCollection('completions'),
      getCollection('levels'),
    ])
      .then(([completionsResult, levelsResult]) => {
        const users = []
        const completions = completionsResult.status === 'fulfilled' ? completionsResult.value : []
        const levels = levelsResult.status === 'fulfilled' ? levelsResult.value : []
        const communityLevels = levels.filter(level => level.type === 'community')
        const communityLevelIds = new Set(communityLevels.map(level => level.id))
        const communityCompletions = completions.filter(completion =>
          completion.status !== 'rejected'
          && (completion.levelType === 'community' || communityLevelIds.has(completion.levelId))
        )
        const publicProfiles = {}
        levels.forEach(level => {
          ;(level.victors || []).forEach(victor => {
            if (!victor.userId) return
            publicProfiles[victor.userId] = {
              id: victor.userId,
              username: victor.username || victor.displayName || 'Basement player',
              displayName: victor.displayName || victor.username || 'Basement player',
              avatarURL: victor.avatarURL || '',
              country: victor.country || '',
            }
          })
        })
        const profilesById = Object.fromEntries([
          ...Object.values(publicProfiles).map(profile => [profile.id, profile]),
          ...users.map(profile => [profile.id, profile]),
        ])
        const namesById = Object.fromEntries(
          Object.values(profilesById).map(profile => [profile.id, getDisplayName(profile)]),
        )
        const pointsMap = Object.fromEntries(
          communityLevels.filter(level => (level.position || 0) > 0).map(level => [level.id, level.position]),
        )
        const { totals } = computeUserCommunityPoints(communityCompletions, pointsMap)
        const mainTotals = completions.reduce((totalsByUser, completion) => {
          if (completion.status === 'rejected' || completion.levelType === 'community' || !completion.userId) {
            return totalsByUser
          }
          totalsByUser[completion.userId] = (totalsByUser[completion.userId] || 0) + (Number(completion.points) || 0)
          return totalsByUser
        }, {})
        const leaderboardProfiles = Object.values(profilesById)
        const topMain = leaderboardProfiles
          .map(profile => ({
            ...profile,
            stats: {
              ...profile.stats,
              mainPoints: profile.stats?.mainPoints || mainTotals[profile.id] || 0,
            },
          }))
          .filter(user => (user.stats?.mainPoints || 0) > 0)
          .sort((a, b) => (b.stats?.mainPoints || 0) - (a.stats?.mainPoints || 0))
          .slice(0, 3)
        const topCommunity = leaderboardProfiles
          .map(user => ({ ...user, livePoints: totals[user.id] || 0 }))
          .filter(user => user.livePoints > 0)
          .sort((a, b) => b.livePoints - a.livePoints)
          .slice(0, 3)
        const recent = communityCompletions
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
              users: Math.max(users.length, Object.keys(publicProfiles).length),
              records: communityCompletions.length,
              levels: communityLevels.length,
            },
          })
          const partialFailure = [completionsResult, levelsResult]
            .some(result => result.status === 'rejected')
          setLoadError(partialFailure ? 'home.partialData' : '')
        }
      })
      .catch(error => {
        console.error('Failed to load home data:', error)
        if (mounted) setLoadError('home.noData')
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
      text: t('home.completed', { level: record.levelName || t('home.aDemon') }),
      time: formatDateRelative(record.completedAt || record.createdAt),
      href: record.levelId ? `/levels/${record.levelId}` : '/list/community',
    }))
    const levels = highlights.newLevels.map(level => ({
      id: `level-${level.id}`,
      type: 'level',
      title: level.name,
      text: t('home.joinedList', { creator: level.creator || t('common.unknown') }),
      time: formatDateRelative(level.createdAt || level.firstCompletedAt),
      href: `/levels/${level.id}`,
    }))

    return [...records, ...levels].slice(0, 5)
  }, [highlights, t])

  const statItems = [
    { icon: Users, value: highlights.stats.users, label: t('common.players') },
    { icon: Trophy, value: highlights.stats.records, label: t('common.records') },
    { icon: List, value: highlights.stats.levels, label: t('common.levels') },
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
            <span>{t('home.eyebrow')}</span>
          </div>

          <h1 className={styles.heroTitle}>
            {t('home.title')}<br />
            <span>{t('home.accentTitle')}</span>
          </h1>

          <p className={styles.heroSubtitle}>
            {t('home.subtitle')}
          </p>

          <div className={styles.stats} aria-label={t('home.overview')}>
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
              {t('home.exploreList')} <ArrowRight size={17} />
            </Link>
            <Link className={styles.secondaryAction} to="/submit">
              {t('home.submitRecord')} <Trophy size={17} />
            </Link>
            <Link className={styles.secondaryAction} to="/submit-level">
              {t('home.submitLevel')} <Upload size={17} />
            </Link>
          </div>

          <div className={styles.socialLinks} aria-label={t('home.socialLinks')}>
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
              <span>{t(loadError)}</span>
              <button type="button" onClick={() => setRetryKey(key => key + 1)}>{t('home.retry')}</button>
            </div>
          )}
        </motion.div>

        <motion.aside
          className={styles.listSpotlight}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.16, duration: 0.55, ease: 'easeOut' }}
          aria-label={t('home.listPreview')}
        >
          <div className={styles.spotlightTopline}>
            <div>
              <span className={styles.liveDot} />
              <span>{t('home.currentRanking')}</span>
            </div>
            <Link to={activeListHref}>{t('home.openFullList')} <ArrowRight size={14} /></Link>
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
                  <small>{t('common.by', { name: level.creator || t('common.unknown') })}</small>
                </span>
                <span className={styles.previewPoints}>{formatNumber(level.points || 0)} pts</span>
                <ChevronRight size={15} />
              </Link>
            ))}

            {!loading && previewLevels.length === 0 && (
              <div className={styles.previewEmpty}>
                <List size={20} />
                <strong>{t('home.communityList')}</strong>
                <span>{t('home.previewEmpty')}</span>
              </div>
            )}
          </div>

          <Link className={styles.spotlightFooter} to={activeListHref}>
            {t('home.browseAll')}
            <ArrowRight size={15} />
          </Link>
        </motion.aside>
      </section>

      <section className={styles.dashboard} aria-label={t('home.overview')}>
        <motion.article
          className={`${styles.panel} ${styles.activityPanel}`}
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
        >
          <header className={styles.panelHeader}>
            <div>
              <Activity size={18} />
              <h2>{t('home.recentActivity')}</h2>
            </div>
            <Link to="/list/community">{t('home.viewAll')} <ArrowRight size={14} /></Link>
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
                <time>{item.time || t('common.recently')}</time>
              </Link>
            ))}

            {!loading && activity.length === 0 && (
              <div className={styles.emptyActivity}>
                <Sparkles size={18} />
                <span>{t('home.nextRecord')}</span>
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
              <h2>{t('home.why')}</h2>
            </div>
          </header>

          <div className={styles.benefitList}>
            {communityBenefits.map(({ icon: Icon, titleKey, descriptionKey }) => (
              <div className={styles.benefit} key={titleKey}>
                <span><Icon size={18} /></span>
                <div>
                  <h3>{t(titleKey)}</h3>
                  <p>{t(descriptionKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.aside>
      </section>

      {!loading && (
        <section className={styles.leaderboards} aria-label={t('footer.rankings')}>
          <article className={styles.leaders}>
            <div className={styles.leadersHeading}>
              <div>
                <Crown size={18} />
                <span>{t('home.mainLeaders')}</span>
              </div>
              <Link to="/leaderboard/main">{t('home.fullLeaderboard')} <ArrowRight size={14} /></Link>
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
                <p className={styles.leaderEmpty}>{t('home.mainUnavailable')}</p>
              )}
            </div>
          </article>

          <article className={styles.leaders}>
            <div className={styles.leadersHeading}>
              <div>
                <Crown size={18} />
                <span>{t('home.communityLeaders')}</span>
              </div>
              <Link to="/leaderboard/community">{t('home.fullLeaderboard')} <ArrowRight size={14} /></Link>
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
                <p className={styles.leaderEmpty}>{t('home.communityUnavailable')}</p>
              )}
            </div>
          </article>
        </section>
      )}

      <section className={styles.finalCta}>
        <div>
          <span>{t('home.ready')}</span>
          <h2>{t('home.cta')}</h2>
        </div>
        <div>
          <Link className={styles.primaryAction} to={user ? '/submit' : '/register'}>
            {user ? t('home.submitRecord') : t('home.createAccount')} <ArrowRight size={17} />
          </Link>
          <Link className={styles.textAction} to={user ? '/profile' : '/login'}>
            {user ? t('home.myProfile') : t('home.signIn')}
          </Link>
        </div>
      </section>
    </main>
  )
}
