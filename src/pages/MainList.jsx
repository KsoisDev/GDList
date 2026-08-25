import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, ListChecks, Radio, Trophy } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Badge from '../components/ui/Badge'
import SearchBar from '../components/ui/SearchBar'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { cacheMainLevels, getMainLevelsFallback } from '../services/mainListFallback'
import { loadMainLevels } from '../services/readCache'
import { formatNumber } from '../utils/format'
import { DIFFICULTY_COLORS } from '../utils/constants'
import styles from './List.module.css'

export default function MainList() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadNotice, setLoadNotice] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadError('')
      setLoadNotice('')
      try {
        const data = await loadMainLevels()
        const withWins = data
          .filter(l => (l.victoryCount || 0) > 0)
          .sort((a, b) => a.position - b.position)
        cacheMainLevels(withWins)
        setLevels(withWins.map((level, index) => ({ ...level, _webRank: index + 1 })))
      } catch (err) {
        console.error('Failed to load levels:', err)
        try {
          const fallback = await getMainLevelsFallback()
          if (fallback.length === 0) throw new Error('The saved list is empty')
          const rankedFallback = fallback
            .sort((a, b) => a.position - b.position)
            .map((level, index) => ({ ...level, _webRank: index + 1 }))
          setLevels(rankedFallback)
          setLoadNotice('main.savedNotice')
        } catch (fallbackError) {
          console.error('Failed to load the saved main list:', fallbackError)
          setLoadError('main.loadFailed')
        }
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
  const totalVictories = useMemo(
    () => levels.reduce((total, level) => total + (level.victoryCount || 0), 0),
    [levels],
  )
  const topLevel = levels[0]

  return (
    <PageShell className={styles.mainListShell}>
      <div className={styles.mainListGlow} aria-hidden="true" />
      <section className={styles.mainListHero} aria-labelledby="main-list-title">
        <div className={styles.mainHeroCopy}>
          <span className={styles.mainEyebrow}><Radio size={14} aria-hidden="true" /> {t('main.eyebrow')}</span>
          <h1 id="main-list-title" className={styles.mainTitle}>{t('main.title')} <span>{t('main.accentTitle')}</span></h1>
          <p className={styles.mainDescription}>
            {t('main.description')}
          </p>
          <div className={styles.mainActions}>
            <Link to="/submit" className={styles.mainPrimaryAction}>
              {t('home.submitRecord')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/list/community" className={styles.mainSecondaryAction}>{t('main.communityList')}</Link>
          </div>
        </div>

        <div className={styles.mainStats} aria-label="Main list statistics">
          <div className={styles.mainStat}>
            <ListChecks size={18} aria-hidden="true" />
            <strong>{loading ? '—' : formatNumber(levels.length)}</strong>
            <span>{t('main.rankedLevels')}</span>
          </div>
          <div className={styles.mainStat}>
            <Trophy size={18} aria-hidden="true" />
            <strong>{loading ? '—' : formatNumber(totalVictories)}</strong>
            <span>{t('main.verifiedClears')}</span>
          </div>
          <div className={`${styles.mainStat} ${styles.mainTopStat}`}>
            <span className={styles.mainRankMark}>#1</span>
            <strong>{loading ? t('common.loading') : topLevel?.name || t('common.unranked')}</strong>
            <span>{t('main.currentHardest')}</span>
          </div>
        </div>
      </section>

      <section className={styles.mainListSurface} aria-label="Main list rankings">
        <div className={styles.mainSurfaceHeading}>
          <div>
            <span className={styles.mainSectionLabel}>{t('main.currentStandings')}</span>
            <h2>{t('main.officialCompletions')}</h2>
          </div>
          <span className={styles.mainCount}>{filtered.length} {filtered.length === 1 ? t('common.level') : t('common.levelsLower')}</span>
        </div>

        <div className={`${styles.toolbar} ${styles.mainToolbar}`}>
          <span className={styles.count}>{t('main.searchHelp')}</span>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t('main.searchPlaceholder')}
            className={styles.searchBar}
          />
        </div>

        {loadNotice && (
          <div className={styles.savedDataNotice} role="status">
            <span>{t(loadNotice)}</span>
            <Button variant="secondary" size="sm" onClick={() => setRetryKey(key => key + 1)}>{t('main.refreshLive')}</Button>
          </div>
        )}

        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : loadError ? (
          <div className={styles.errorState} role="alert">
            <p>{t(loadError)}</p>
            <Button variant="secondary" size="sm" onClick={() => setRetryKey(key => key + 1)}>{t('common.tryAgain')}</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            {search
              ? <p>{t('main.noMatches', { search })}</p>
              : <p>{t('main.noLevels')}</p>}
          </div>
        ) : (
          <div className={`${styles.table} ${styles.mainThemedTable}`}>
          <div className={styles.headerMain}>
            <span className={styles.colWeb}>{t('main.webRank')}</span>
            <span className={styles.colOff}>{t('main.officialRank')}</span>
            <span className={styles.colName}>{t('common.level')}</span>
            <span className={styles.colDiff}>{t('main.difficulty')}</span>
            <span className={styles.colPoints}>{t('common.points')}</span>
            <span className={styles.colCreator}>{t('common.creator')}</span>
            <span className={styles.colVictories}>{t('common.victories')}</span>
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
                      <span className={styles.creator}>{t('common.by', { name: level.creator })}</span>
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
      </section>
    </PageShell>
  )
}
