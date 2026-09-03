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
  Github,
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
import LanguageSelector from '../components/layout/LanguageSelector'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { loadUsers, loadCommunityLevels } from '../services/readCache'
import { getCollection, where } from '../services/firestore'
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

const devLogEntries = [
  ['home.devLogCountryTitle', 'home.devLogCountryText'],
  ['home.devLogLanguageTitle', 'home.devLogLanguageText'],
  ['home.devLogUiTitle', 'home.devLogUiText'],
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
  const { t, locale } = useLanguage()
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
      ]),
    ])
      .then(([usersResult, communityLevelsResult, recentResult]) => {
        const users = usersResult.status === 'fulfilled' ? usersResult.value : []
        const communityLevels = communityLevelsResult.status === 'fulfilled' ? communityLevelsResult.value : []
        const recentCompletions = (recentResult.status === 'fulfilled' ? recentResult.value : [])
          .sort((a, b) => {
            const ta = a.completedAt?.toMillis?.() || 0
            const tb = b.completedAt?.toMillis?.() || 0
            return tb - ta
          })
          .slice(0, 4)

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
            : c.username || '',
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
          setLoadError(partialFailure ? 'home.partialError' : '')
        }
      })
      .catch(error => {
        console.error('Failed to load home data:', error)
        if (mounted) setLoadError('home.loadError')
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
      title: record.username || t('home.communityPlayer'),
      text: t('home.completed', { level: record.levelName || t('home.aDemon') }),
      time: formatDateRelative(record.completedAt || record.createdAt, locale),
      href: record.levelId ? `/levels/${record.levelId}` : '/list/community',
    }))
    const levels = highlights.newLevels.map(level => ({
      id: `level-${level.id}`,
      type: 'level',
      title: level.name,
      text: t('home.joinedList', { creator: level.creator || t('home.unknown') }),
      time: formatDateRelative(level.createdAt || level.firstCompletedAt, locale),
      href: `/levels/${level.id}`,
    }))

    return [...records, ...levels].slice(0, 5)
  }, [highlights, locale, t])

  const statItems = [
    { icon: Users, value: highlights.stats.users, label: t('home.players') },
    { icon: Trophy, value: highlights.stats.records, label: t('home.records') },
    { icon: List, value: highlights.stats.levels, label: t('home.levels') },
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
            {t('home.titleLine1')}<br />
            <span>{t('home.titleLine2')}</span>
          </h1>

          <p className={styles.heroSubtitle}>
            {t('home.subtitle')}
          </p>

          <div className={styles.stats} aria-label={t('home.statsLabel')}>
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
              {t('home.explore')} <ArrowRight size={17} />
            </Link>
            <Link className={styles.secondaryAction} to="/submit">
              {t('home.submitRecord')} <Trophy size={17} />
            </Link>
            <Link className={styles.secondaryAction} to="/submit-level">
              {t('home.submitLevel')} <Upload size={17} />
            </Link>
          </div>

          <div className={styles.socialLinks} aria-label={t('home.socialLabel')}>
            <a href="https://discord.gg/75FaX3gmM2" target="_blank" rel="noopener noreferrer">
              <Users size={14} /> Discord
            </a>
            <a href="https://www.tiktok.com/@tnaillzgd" target="_blank" rel="noopener noreferrer">
              <Music size={14} /> TikTok
            </a>
            <a href="https://www.youtube.com/@tNaiLLzxGd" target="_blank" rel="noopener noreferrer">
              <Youtube size={14} /> YouTube
            </a>
            <a href="https://github.com/ksois/GDList" target="_blank" rel="noopener noreferrer">
              <Github size={14} /> GitHub
            </a>
          </div>

          <div className={styles.languageControl}>
            <span>{t('language.label')}</span>
            <LanguageSelector />
          </div>
          {loadError && (
            <div className={styles.dataNotice} role="alert">
              <span>{t(loadError)}</span>
              <button type="button" onClick={() => setRetryKey(key => key + 1)}>{t('home.tryAgain')}</button>
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
                  <small>{t('home.by')} {level.creator || t('home.unknown')}</small>
                </span>
                <span className={styles.previewPoints}>{formatNumber(level.points || 0)} {t('home.pointsShort')}</span>
                <ChevronRight size={15} />
              </Link>
            ))}

            {!loading && previewLevels.length === 0 && (
              <div className={styles.previewEmpty}>
                <List size={20} />
                <strong>{t('home.communityList')}</strong>
                <span>{t('home.emptyList')}</span>
              </div>
            )}
          </div>

          <Link className={styles.spotlightFooter} to={activeListHref}>
            {t('home.browseCommunity')}
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
                <time>{item.time || t('home.recently')}</time>
              </Link>
            ))}

            {!loading && activity.length === 0 && (
              <div className={styles.emptyActivity}>
                <Sparkles size={18} />
                <span>{t('home.emptyActivity')}</span>
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

      <motion.section
        className={styles.devLog}
        aria-labelledby="latest-dev-log-title"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
      >
        <header className={styles.devLogHeader}>
          <div>
            <span className={styles.devLogEyebrow}><Sparkles size={14} aria-hidden="true" /> {t('home.devLogEyebrow')}</span>
            <h2 id="latest-dev-log-title">{t('home.devLogTitle')}</h2>
          </div>
          <time dateTime="2026-09-03">{t('home.devLogDate')}</time>
        </header>
        <div className={styles.devLogEntries}>
          {devLogEntries.map(([titleKey, textKey]) => (
            <article className={styles.devLogEntry} key={titleKey}>
              <span className={styles.devLogCheck}><CheckCircle2 size={17} aria-hidden="true" /></span>
              <div>
                <h3>{t(titleKey)}</h3>
                <p>{t(textKey)}</p>
              </div>
            </article>
          ))}
        </div>
        <a
          className={styles.devLogLink}
          href="https://github.com/defnotsquishy/GDList/commits/beta-site"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github size={16} aria-hidden="true" /> {t('home.devLogLink')} <ArrowRight size={14} aria-hidden="true" />
        </a>
      </motion.section>

      {!loading && (
        <section className={styles.leaderboards} aria-label={t('home.topRankings')}>
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
                  <span>{formatNumber(player.stats?.communityPoints || 0)} pts</span>
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
          <h2>{t('home.makeRun')}</h2>
        </div>
        <div>
          <Link className={styles.primaryAction} to={user ? '/submit' : '/register'}>
            {user ? t('home.submitRecord') : t('nav.createAccount')} <ArrowRight size={17} />
          </Link>
          <Link className={styles.textAction} to={user ? '/profile' : '/login'}>
            {user ? t('home.myProfile') : t('nav.signIn')}
          </Link>
        </div>
      </section>
    </main>
  )
}
