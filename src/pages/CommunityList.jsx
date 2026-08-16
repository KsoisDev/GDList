import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Edit3, Trash2, Youtube, X, Trophy } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Card from '../components/ui/Card'
import SearchBar from '../components/ui/SearchBar'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { getCollection } from '../services/firestore'
import { getCommunityLevels, deleteCommunityLevel } from '../services/communityList'
import { hasAccess } from '../utils/constants'
import { getYouTubeThumbnail } from '../utils/video'
import styles from './List.module.css'

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'unverified', label: 'Levels to Verify' },
]

export default function CommunityList() {
  const { user, userData } = useAuth()
  const isAdmin = hasAccess(userData?.role || 'user', 'admin')
  const [levels, setLevels] = useState([])
  const [tags, setTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')

  useEffect(() => {
    getCollection('tags')
      .then(data => setTags(data))
      .catch(err => console.error('Failed to load tags:', err))
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await getCommunityLevels()
      setLevels(data)
    } catch (err) {
      console.error('Failed to load community levels:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (level) => {
    if (!confirm(`Delete "${level.name}" from the community list? Its victors will lose the community points earned on this level.`)) return
    try {
      await deleteCommunityLevel(level.id)
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
    <PageShell title="Community Demon List" subtitle="Levels created and verified by our community members">
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.count}>
            {visible.length} {visible.length === 1 ? 'level' : 'levels'}
          </span>
          {selectedTags.length > 0 && (
            <button className={styles.clearFilter} onClick={() => setSelectedTags([])}>
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search level, creator or ID..."
          className={styles.searchBar}
        />
      </div>

      {tags.length > 0 && (
        <div className={styles.tagFilters}>
          <span className={styles.tagFiltersLabel}>Filter by tag:</span>
          {tags.map(tag => {
            const active = selectedTags.includes(tag.id)
            return (
              <button
                key={tag.id}
                className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
                style={active ? { background: tag.color, borderColor: tag.color } : undefined}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Spinner size="lg" />
        </div>
      ) : tab === 'active' && visible.length === 0 ? (
        <Card padding="lg" className={styles.empty}>
          {selectedTags.length > 0
            ? <p>No active community levels match the selected tags.</p>
            : <p>No active community levels yet. Levels appear here once they have at least one completion.</p>}
        </Card>
      ) : tab === 'unverified' && visible.length === 0 ? (
        <Card padding="lg" className={styles.empty}>
          {selectedTags.length > 0
            ? <p>No levels to verify match the selected tags.</p>
            : <p>No unverified levels. New level submissions will appear here once approved by an admin.</p>}
        </Card>
      ) : (
        <div className={`${styles.table} ${isAdmin ? styles.withActions : ''}`}>
          <div className={styles.tableHeader}>
            <span className={styles.colPos}>#</span>
            <span className={styles.colName}>Level</span>
            <span className={styles.colDiff}>ID</span>
            {tab === 'active' && <span className={styles.colPoints}>Points</span>}
            <span className={styles.colVerifier}>Creators</span>
            <span className={styles.colCreator}>Submitter</span>
            {isAdmin && <span className={styles.colActions}>Actions</span>}
          </div>

          {visible.map((level, i) => {
            const completed = !!user && (level.victors || []).some(v => v.userId === user.uid)
            const videoURL = tab === 'active'
              ? (level.victors || [])[0]?.videoURL
              : level.videoURL
            const thumbnail = getYouTubeThumbnail(videoURL)
            const levelTags = levelTagsMap(level)
            return (
            <motion.div
              key={level.id}
              className={`${styles.tableRow} ${completed ? styles.completed : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
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
                    <span className={styles.creator}>by {level.creator}</span>
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
                      title={tab === 'active' ? 'Verifier video' : 'Showcase video'}
                      aria-label={tab === 'active' ? 'Verifier video' : 'Showcase video'}
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
                    title="Edit level"
                    aria-label="Edit level"
                  >
                    <Edit3 size={16} />
                  </Link>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(level)}
                    title="Delete level"
                    aria-label="Delete level"
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
    </PageShell>
  )
}
