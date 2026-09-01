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
import { loadMainLevels } from '../services/readCache'
import { getGlobalLevelArtworkIndex } from '../services/globalDemonList'
import { formatNumber } from '../utils/format'
import { DIFFICULTY_COLORS } from '../utils/constants'
import styles from './List.module.css'

export default function MainList() {
  const { user } = useAuth()
  const { t } = useLanguage()
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
        const [data, artworkIndex] = await Promise.all([
          loadMainLevels(),
          getGlobalLevelArtworkIndex().catch(error => {
            console.warn('Global Demonlist artwork is unavailable:', error)
            return null
          }),
        ])
        const withWins = data
          .filter(l => (l.victoryCount || 0) > 0)
          .sort((a, b) => a.position - b.position)
        setLevels(withWins.map((level, index) => ({
          ...level,
          _webRank: index + 1,
          _gdlArtwork: artworkIndex?.match(level) || null,
        })))
      } catch (err) {
        console.error('Failed to load levels:', err)
        setLoadError('list.mainLoadError')
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
          <span className={styles.mainEyebrow}><Radio size={14} aria-hidden="true" /> {t('list.mainEyebrow')}</span>
          <h1 id="main-list-title" className={styles.mainTitle}>{t('list.mainTitle')} <span>{t('list.mainAccent')}</span></h1>
          <p className={styles.mainDescription}>
            {t('list.mainDescription')}
          </p>
          <div className={styles.mainActions}>
            <Link to="/submit" className={styles.mainPrimaryAction}>
              {t('home.submitRecord')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/list/community" className={styles.mainSecondaryAction}>{t('nav.communityList')}</Link>
          </div>
        </div>

        <div className={styles.mainStats} aria-label="Main list statistics">
          <div className={styles.mainStat}>
            <ListChecks size={18} aria-hidden="true" />
            <strong>{loading ? '—' : formatNumber(levels.length)}</strong>
            <span>Ranked levels</span>
          </div>
          <div className={styles.mainStat}>
            <Trophy size={18} aria-hidden="true" />
            <strong>{loading ? '—' : formatNumber(totalVictories)}</strong>
            <span>Verified clears</span>
          </div>
          <div className={`${styles.mainStat} ${styles.mainTopStat}`}>
            <span className={styles.mainRankMark}>#1</span>
            <strong>{loading ? 'Loading' : topLevel?.name || 'Unranked'}</strong>
            <span>Current hardest</span>
          </div>
        </div>
      </section>

      <section className={styles.mainListSurface} aria-label="Main list rankings">
        <div className={styles.mainSurfaceHeading}>
          <div>
            <span className={styles.mainSectionLabel}>CURRENT STANDINGS</span>
            <h2>Official completions</h2>
          </div>
          <span className={styles.mainCount}>{filtered.length} {filtered.length === 1 ? 'level' : 'levels'}</span>
        </div>

        <div className={`${styles.toolbar} ${styles.mainToolbar}`}>
          <span className={styles.count}>{t('list.searchLevel')}</span>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={t('list.searchLevel')}
            className={styles.searchBar}
          />
        </div>

        {loading ? (
          <div className={styles.loading}><Spinner size="lg" /></div>
        ) : loadError ? (
          <div className={styles.errorState} role="alert">
            <p>{t(loadError)}</p>
            <Button variant="secondary" size="sm" onClick={() => setRetryKey(key => key + 1)}>{t('leaderboard.tryAgain')}</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            {search
              ? <p>{t('list.empty')}</p>
              : <p>No levels completed yet. Submit your first record!</p>}
          </div>
        ) : (
          <div className={styles.mainLevelCards}>
          {filtered.map((level, i) => {
            const completed = !!user && (level.victors || []).some(v => v.userId === user.uid)
            return (
            <motion.div
              key={level.id}
              className={styles.mainLevelCardMotion}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.02 }}
            >
              <Link to={`/levels/${level.id}`} className={`${styles.mainLevelCard} ${completed ? styles.completed : ''}`}>
                {level._gdlArtwork?.thumbnail && (
                  <img
                    src={level._gdlArtwork.thumbnail}
                    alt=""
                    className={styles.mainLevelThumbnail}
                    loading="lazy"
                  />
                )}
                <div className={styles.mainLevelCardBody}>
                  <div className={styles.mainLevelCardHeading}>
                    <span className={styles.mainCardRank}>#{level._webRank}</span>
                    <span className={styles.mainCardName}>{level.name}</span>
                    {completed && <Trophy size={15} className={styles.completedTrophy} aria-label="Completed" />}
                  </div>
                  <div className={styles.mainLevelMeta}>
                    <span>{t('home.by')} <strong>{level.creator}</strong></span>
                    <span className={styles.mainMetaDivider} aria-hidden="true" />
                    <span>{t('list.officialRank')} <strong>#{level.position}</strong></span>
                    {level._gdlArtwork?.placement > 0 && level._gdlArtwork.placement !== level.position && (
                      <>
                        <span className={styles.mainMetaDivider} aria-hidden="true" />
                        <span>GDL <strong>#{level._gdlArtwork.placement}</strong></span>
                      </>
                    )}
                  </div>
                  <div className={styles.mainLevelFacts}>
                    <Badge variant="default" size="sm" style={{ color: diffColor(level.difficulty), borderColor: diffColor(level.difficulty) }}>
                      {level.difficulty}
                    </Badge>
                    <span className={styles.mainCardPoints}>{formatNumber(level.points)} {t('list.points').toLowerCase()}</span>
                    <span className={styles.mainCardVictories}>
                      <Trophy size={14} aria-hidden="true" />
                      {formatNumber(level.victoryCount || 0)} {t('list.victories').toLowerCase()}
                    </span>
                  </div>
                </div>
                <ArrowRight size={18} className={styles.mainCardArrow} aria-hidden="true" />
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
