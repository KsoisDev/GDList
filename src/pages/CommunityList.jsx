import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock3, Edit3, ListChecks, Trash2, Youtube, X, Trophy } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import ThemedPageHero from '../components/layout/ThemedPageHero'
import Card from '../components/ui/Card'
import SearchBar from '../components/ui/SearchBar'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { loadCommunityLevels, loadTags, invalidateCache } from '../services/readCache'
import { deleteCommunityLevel } from '../services/communityList'
import { hasAccess } from '../utils/constants'
import { getVideoThumbnail } from '../utils/video'
import styles from './List.module.css'
import theme from '../components/layout/ThemedPage.module.css'

const TABS = [
  { id: 'active', labelKey: 'community.active' },
  { id: 'unverified', labelKey: 'community.toVerify' },
]

export default function CommunityList() {
  const { user, userData } = useAuth()
  const { t } = useLanguage()
  const isAdmin = hasAccess(userData?.role || 'user', 'admin')
  const [levels, setLevels] = useState([])
  const [tags, setTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('active')

  useEffect(() => {
    loadTags()
      .then(data => setTags(data))
      .catch(err => console.error('Failed to load tags:', err))
  }, [])

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await loadCommunityLevels()
      data.sort((a, b) => (a.position || 0) - (b.position || 0))
      setLevels(data)
    } catch (err) {
      console.error('Failed to load community levels:', err)
      setLoadError('community.loadFailed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (level) => {
    if (!confirm(`Delete "${level.name}" from the community list? Its victors will lose the community points earned on this level.`)) return
    try {
      await deleteCommunityLevel(level.id)
      invalidateCache('communityLevels')
      await load()
    } catch (err) {
      console.error('Failed to delete level:', err)
    }
  }

  const active = levels.filter(l => (l.victoryCount || 0) > 0)
  const unverified = levels.filter(l => (l.victoryCount || 0) === 0)

  const matchesTags = (level) => {
    if (selectedTags.length === 0) return true
    const levelTags = level.tags || []
    return selectedTags.every(id => levelTags.includes(id))
  }

  const matchesSearch = (level) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      level.name?.toLowerCase().includes(q) ||
      level.creator?.toLowerCase().includes(q) ||
      (level.gameId || '').includes(q)
    )
  }

  const filteredByTags = useMemo(() => active.filter(matchesTags), [active, selectedTags])

  const activeFiltered = filteredByTags.filter(matchesSearch)
  const unverifiedFiltered = unverified.filter(matchesTags).filter(matchesSearch)
  const visible = tab === 'active' ? activeFiltered : unverifiedFiltered

  const toggleTag = (id) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const levelTagsMap = (level) => {
    return (level.tags || [])
      .map(id => tags.find(t => t.id === id))
      .filter(Boolean)
  }

  return (
    <PageShell className={theme.pageShell}>
      <div className={theme.glow} aria-hidden="true" />
      <ThemedPageHero
        eyebrow={t('community.eyebrow')}
        title={t('community.title')}
        accentTitle={t('community.accentTitle')}
        description={t('community.description')}
        actions={[
          { to: '/submit-level', label: t('community.submitLevel') },
          { to: '/list/main', label: t('community.mainList') },
        ]}
        stats={[
          { icon: ListChecks, value: loading ? '—' : active.length, label: t('main.rankedLevels') },
          { icon: Trophy, value: loading ? '—' : active.reduce((sum, level) => sum + (level.victoryCount || 0), 0), label: t('main.verifiedClears') },
          { icon: Clock3, value: loading ? '—' : unverified.length, label: t('community.awaiting'), featured: true },
        ]}
      />

      <section className={theme.surface} aria-label={t('nav.communityRankings')}>
        <div className={theme.surfaceHeading}>
          <div>
            <span className={theme.sectionLabel}>{t('community.standings')}</span>
            <h2>{t('community.originalLevels')}</h2>
          </div>
          <span className={theme.count}>{visible.length} {visible.length === 1 ? t('common.level') : t('common.levelsLower')}</span>
        </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.count}>
            {visible.length} {visible.length === 1 ? t('common.level') : t('common.levelsLower')}
          </span>
          {selectedTags.length > 0 && (
            <button type="button" className={styles.clearFilter} onClick={() => setSelectedTags([])}>
              <X size={14} aria-hidden="true" /> {t('community.clearFilters')}
            </button>
          )}
        </div>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t('community.searchPlaceholder')}
          className={styles.searchBar}
        />
      </div>

      {tags.length > 0 && (
        <div className={styles.tagFilters}>
          <span className={styles.tagFiltersLabel}>{t('community.filterTag')}</span>
          {tags.map(tag => {
            const active = selectedTags.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
                style={active ? { background: tag.color, borderColor: tag.color } : undefined}
                onClick={() => toggleTag(tag.id)}
                aria-pressed={active}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.tabs}>
        {TABS.map(tabOption => (
          <button
            key={tabOption.id}
            type="button"
            className={`${styles.tab} ${tab === tabOption.id ? styles.tabActive : ''}`}
            onClick={() => setTab(tabOption.id)}
            aria-pressed={tab === tabOption.id}
          >
            {t(tabOption.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      ) : loadError ? (
        <Card padding="lg" className={styles.errorState}>
          <p>{t(loadError)}</p>
          <Button variant="secondary" size="sm" onClick={load}>{t('common.tryAgain')}</Button>
        </Card>
      ) : tab === 'active' && visible.length === 0 ? (
        <Card padding="lg" className={styles.empty}>
          {selectedTags.length > 0
            ? <p>{t('community.noActiveTags')}</p>
            : <p>{t('community.noActive')}</p>}
        </Card>
      ) : tab === 'unverified' && visible.length === 0 ? (
        <Card padding="lg" className={styles.empty}>
          {selectedTags.length > 0
            ? <p>{t('community.noVerifyTags')}</p>
            : <p>{t('community.noVerify')}</p>}
        </Card>
      ) : (
        <div className={`${styles.table} ${isAdmin ? styles.withActions : ''} ${tab === 'unverified' ? styles.unverifiedTable : ''}`}>
          <div className={styles.tableHeader}>
            <span className={styles.colPos}>#</span>
            <span className={styles.colName}>{t('common.level')}</span>
            <span className={styles.colDiff}>{t('community.id')}</span>
            {tab === 'active' && <span className={styles.colPoints}>{t('common.points')}</span>}
            <span className={styles.colVerifier}>{t('common.creators')}</span>
            <span className={styles.colCreator}>{t('common.submitter')}</span>
            {isAdmin && <span className={styles.colActions}>{t('common.actions')}</span>}
          </div>

          {visible.map((level, i) => {
            const completed = !!user && (level.victors || []).some(v => v.userId === user.uid)
            const videoURL = tab === 'active'
              ? (level.victors || [])[0]?.videoURL
              : level.videoURL
            const thumbnail = getVideoThumbnail(videoURL)
            const levelTags = levelTagsMap(level)
            return (
            <motion.div
              key={level.id}
              className={`${styles.tableRow} ${completed ? styles.completed : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.02 }}
            >
              <span className={styles.colPos}>
                <span className={styles.position}>
                  {tab === 'unverified' && (level.victoryCount || 0) === 0 ? '—' : `#${level.position}`}
                </span>
              </span>
              <span className={styles.colName}>
                <div className={styles.levelInfo}>
                  {thumbnail && (
                    <img src={thumbnail} alt="" className={styles.thumbnail} loading="lazy" />
                  )}
                  <div className={styles.levelInfoText}>
                    {tab === 'active' ? (
                      <Link to={`/levels/${level.id}`} className={styles.levelLink}>
                        <span className={styles.levelNameWrap}>
                          <span className={styles.levelName}>{level.name}</span>
                          {completed && <Trophy size={14} className={styles.completedTrophy} />}
                        </span>
                      </Link>
                    ) : isAdmin ? (
                      <Link to={`/levels/${level.id}`} className={styles.levelLink}>
                        <span className={styles.levelNameWrap}>
                          <span className={styles.levelName}>{level.name}</span>
                          {completed && <Trophy size={14} className={styles.completedTrophy} />}
                        </span>
                      </Link>
                    ) : (
                      <span className={styles.levelNameWrap}>
                        <span className={styles.levelName}>{level.name}</span>
                        {completed && <Trophy size={14} className={styles.completedTrophy} />}
                      </span>
                    )}
                    <span className={styles.creator}>{t('common.by', { name: level.creator })}</span>
                    {levelTags.length > 0 && (
                      <span className={styles.levelTags}>
                        {levelTags.map(tag => (
                          <span
                            key={tag.id}
                            className={styles.miniTag}
                            style={{ background: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  {videoURL ? (
                    <a
                      href={videoURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.videoBtn}
                      title={tab === 'active' ? t('community.verifierVideo') : t('community.showcaseVideo')}
                      aria-label={tab === 'active' ? t('community.verifierVideo') : t('community.showcaseVideo')}
                    >
                      <Youtube size={18} />
                    </a>
                  ) : null}
                </div>
              </span>
              <span className={styles.colDiff}>
                <span className={styles.gameId}>{level.gameId || '—'}</span>
              </span>
              {tab === 'active' && (
                <span className={styles.colPoints}>
                  <span className={styles.points}>{level.points}</span>
                </span>
              )}
              <span className={styles.colVerifier}>
                <span className={styles.verifier}>{level.creator}</span>
              </span>
              <span className={styles.colCreator}>
                <span className={styles.creator}>—</span>
              </span>
              {isAdmin && (
                <span className={styles.colActions}>
                  <Link
                    to={`/levels/${level.id}`}
                    className={styles.editBtn}
                    title={t('community.editLevel')}
                    aria-label={t('community.editLevel')}
                  >
                    <Edit3 size={16} />
                  </Link>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(level)}
                    title={t('community.deleteLevel')}
                    aria-label={t('community.deleteLevel')}
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              )}
            </motion.div>
            )
          })}
        </div>
      )}
      </section>
    </PageShell>
  )
}
