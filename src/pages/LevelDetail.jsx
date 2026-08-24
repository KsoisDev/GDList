import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trophy, Youtube, Medal, ArrowLeft, Users, Edit3, Save, X } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { getDocument, updateDocument, getCollection } from '../services/firestore'
import { setCommunityPosition } from '../services/communityList'
import { getLevelChangelog, changelogActionLabel } from '../services/changelog'
import { formatNumber, formatDate, parseDecimal } from '../utils/format'
import { DIFFICULTIES, DIFFICULTY_COLORS, hasAccess } from '../utils/constants'
import { getFlagUrl } from '../utils/countries'
import { getVideoThumbnail } from '../utils/video'
import styles from './LevelDetail.module.css'

export default function LevelDetail() {
  const { user, userData } = useAuth()
  const { levelId } = useParams()
  const [level, setLevel] = useState(null)
  const [tags, setTags] = useState([])
  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await getDocument('levels', levelId)
        setLevel(data)
        if (data?.type === 'community') {
          getCollection('tags')
            .then(t => setTags(t))
            .catch(err => console.error('Failed to load tags:', err))
          getLevelChangelog(levelId)
            .then(c => setChanges(c))
            .catch(err => console.error('Failed to load changelog:', err))
        }
        if (data) {
          setEditFields({
            name: data.name || '',
            creator: data.creator || '',
            difficulty: data.difficulty || 'extreme',
            gameId: data.gameId || '',
            position: data.position || 0,
            points: data.points || 0,
            videoURL: data.videoURL || '',
            tags: data.tags || [],
          })
        }
      } catch (err) {
        console.error('Failed to load level:', err)
      } finally {
        setLoading(false)
      }
    }
    if (levelId) load()
  }, [levelId])

  const handleSave = async () => {
    setSaving(true)
    setEditError('')
    try {
      const isCommunity = level?.type === 'community' || levelId?.startsWith('community_')

      if (isCommunity) {
        await updateDocument('levels', levelId, {
          name: editFields.name,
          creator: editFields.creator,
          gameId: editFields.gameId,
          videoURL: editFields.videoURL,
          tags: editFields.tags || [],
        })
        const newPos = Number(editFields.position)
        if (newPos && newPos !== (level.position || 0) && (level.victoryCount || 0) > 0) {
          await setCommunityPosition(levelId, newPos)
        }
        const fresh = await getDocument('levels', levelId)
        if (fresh) {
          setLevel(fresh)
          setEditFields({
            name: fresh.name || '',
            creator: fresh.creator || '',
            difficulty: fresh.difficulty || 'extreme',
            gameId: fresh.gameId || '',
            position: fresh.position || 0,
            points: fresh.points || 0,
            videoURL: fresh.videoURL || '',
            tags: fresh.tags || [],
          })
        }
      } else {
        const newPoints = parseDecimal(editFields.points) || 0
        const diff = parseFloat((newPoints - (level.points || 0)).toFixed(2))

        await updateDocument('levels', levelId, {
          name: editFields.name,
          creator: editFields.creator,
          difficulty: editFields.difficulty,
          position: Number(editFields.position) || 0,
          points: newPoints,
        })

        if (diff !== 0 && (level.victors || []).length > 0) {
          const updates = (level.victors || []).map(victor =>
            getDocument('users', victor.userId).then(userDoc => {
              if (!userDoc) return
              const s = userDoc.stats || {}
              return updateDocument('users', victor.userId, {
                stats: {
                  ...s,
                  totalPoints: parseFloat(((s.totalPoints || 0) + diff).toFixed(2)),
                  mainPoints: parseFloat(((s.mainPoints || 0) + diff).toFixed(2)),
                  communityPoints: s.communityPoints || 0,
                },
              })
            })
          )
          await Promise.all(updates)
        }

        setLevel(prev => ({ ...prev, ...editFields, position: Number(editFields.position) || 0, points: newPoints }))
      }

      setEditing(false)
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const isAdmin = hasAccess(userData?.role || 'user', 'admin')
  const diffOptions = DIFFICULTIES.map(d => ({ value: d.id, label: d.label }))

  if (loading) {
    return (
      <PageShell>
        <div className={styles.loading}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  if (!level) {
    return (
      <PageShell title="Level Not Found">
        <p>This level does not exist in our records.</p>
      </PageShell>
    )
  }

  const diffColor = DIFFICULTY_COLORS[level.difficulty?.toLowerCase()] || '#ffffff'
  const victors = level.victors || []
  const levelVideoURL = level.videoURL || victors[0]?.videoURL
  const thumbnail = getVideoThumbnail(levelVideoURL)

  return (
    <PageShell>
      <div className={styles.page}>
        <Link to={`/list/${level.type === 'community' ? 'community' : 'main'}`} className={styles.backLink}>
          <ArrowLeft size={16} /> Back to {level.type === 'community' ? 'Community' : 'Main'} List
        </Link>

        <Card padding="lg" className={styles.header}>
          <div className={styles.headerContent}>
            {thumbnail && (
              <a href={levelVideoURL} target="_blank" rel="noopener noreferrer" className={styles.heroThumb}>
                <img src={thumbnail} alt={`${level.name} video thumbnail`} loading="lazy" />
                <span className={styles.heroPlay}><Youtube size={18} /></span>
              </a>
            )}
            <div className={styles.rankBadge}>
              <span className={styles.rankNumber}>#{level.position}</span>
            </div>
            <div className={styles.headerInfo}>
              <div className={styles.headerRow}>
                <h1 className={styles.levelName}>{level.name}</h1>
                {isAdmin && !editing && (
                  <button type="button" className={styles.editBtn} onClick={() => { setEditFields({ name: level.name, creator: level.creator, difficulty: level.difficulty, gameId: level.gameId || '', position: level.position, points: level.points, videoURL: level.videoURL || '', tags: level.tags || [] }); setEditing(true) }}>
                    <Edit3 size={16} /> Edit
                  </button>
                )}
                {isAdmin && editing && (
                  <div className={styles.editActions}>
                    <Button variant="primary" size="sm" icon={Save} onClick={handleSave} loading={saving}>Save</Button>
                    <Button variant="ghost" size="sm" icon={X} onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                )}
              </div>
              <div className={styles.meta}>
                {level.type === 'community' ? (
                  <Badge variant="default" size="sm" style={{ color: 'var(--accent-blue)', borderColor: 'var(--accent-blue)' }}>
                    ID: {level.gameId || '—'}
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm" style={{ color: diffColor, borderColor: diffColor }}>
                    {level.difficulty}
                  </Badge>
                )}
                <span className={styles.metaText}>by {level.creator}</span>
                {level.verifier && level.verifier !== 'Unknown' && (
                  <span className={styles.metaText}>Verified by {level.verifier}</span>
                )}
              </div>
              {level.type === 'community' && (level.tags || []).length > 0 && (
                <div className={styles.levelTags}>
                  {(level.tags || [])
                    .map(id => tags.find(t => t.id === id))
                    .filter(Boolean)
                    .map(tag => (
                      <span
                        key={tag.id}
                        className={styles.miniTag}
                        style={{ background: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                </div>
              )}
              {isAdmin && editing && (
                <div className={styles.editFields}>
                  <Input label="Name" value={editFields.name} onChange={e => setEditFields({ ...editFields, name: e.target.value })} />
                  <Input label="Creator" value={editFields.creator} onChange={e => setEditFields({ ...editFields, creator: e.target.value })} />
                  {level?.type === 'community' ? (
                    <Input label="Level ID (in-game)" value={editFields.gameId || ''} onChange={e => setEditFields({ ...editFields, gameId: e.target.value })} placeholder="e.g. 10565740" />
                  ) : (
                    <Select label="Difficulty" options={diffOptions} value={editFields.difficulty} onChange={e => setEditFields({ ...editFields, difficulty: e.target.value })} />
                  )}
                  <Input label="Position" type="number" value={editFields.position} onChange={e => setEditFields({ ...editFields, position: e.target.value })} />
                  {level?.type !== 'community' && (
                    <Input label="Points" type="number" value={editFields.points} onChange={e => setEditFields({ ...editFields, points: e.target.value })} />
                  )}
                  {level?.type === 'community' && (
                    <Input
                      label="Showcase Video URL"
                      type="url"
                      value={editFields.videoURL || ''}
                      onChange={e => setEditFields({ ...editFields, videoURL: e.target.value })}
                      placeholder="https://youtu.be/..., https://medal.tv/..., https://tiktok.com/..., https://drive.google.com/..."
                    />
                  )}
                  {level?.type === 'community' && tags.length > 0 && (
                    <div className={styles.tagPicker} style={{ gridColumn: '1 / -1' }}>
                      <span className={styles.tagPickerLabel}>Tags</span>
                      <div className={styles.tagPickerRow}>
                        {tags.map(tag => {
                          const active = (editFields.tags || []).includes(tag.id)
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              className={`${styles.tagChip} ${active ? styles.tagChipActive : ''}`}
                              style={active ? { background: tag.color, borderColor: tag.color } : undefined}
                              aria-pressed={active}
                              onClick={() => setEditFields(prev => ({
                                ...prev,
                                tags: active
                                  ? (prev.tags || []).filter(id => id !== tag.id)
                                  : [...(prev.tags || []), tag.id],
                              }))}
                            >
                              {tag.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {editError && <p className={styles.editError}>{editError}</p>}
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <Trophy size={22} style={{ color: 'var(--accent-gold)' }} />
            <span className={styles.statValue}>{formatNumber(level.points)}</span>
            <span className={styles.statLabel}>Points</span>
          </Card>
          <Card className={styles.statCard}>
            <Users size={22} style={{ color: 'var(--accent-blue)' }} />
            <span className={styles.statValue}>{formatNumber(level.victoryCount || 0)}</span>
            <span className={styles.statLabel}>Victories</span>
          </Card>
          <Card className={styles.statCard}>
            <Medal size={22} style={{ color: 'var(--accent-purple)' }} />
            <span className={styles.statValue}>#{level.position}</span>
            <span className={styles.statLabel}>Position</span>
          </Card>
          {level.firstCompletedAt && (
            <Card className={styles.statCard}>
              <span className={styles.statValue}>{formatDate(level.firstCompletedAt)}</span>
              <span className={styles.statLabel}>First Completion</span>
            </Card>
          )}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Victors ({victors.length})</h2>
          {victors.length === 0 ? (
            <Card padding="md" className={styles.emptyCard}>
              <p>No victors yet. Be the first!</p>
            </Card>
          ) : (
            <div className={styles.victorsList}>
              {victors.map((victor, i) => (
                <motion.div
                  key={`${victor.userId}-${i}`}
                  className={styles.victorCard}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.03 }}
                >
                  <Link to={`/profile/${victor.userId}`} className={styles.victorInfo}>
                    <Avatar src={victor.avatarURL} alt={victor.displayName || victor.username} size="sm" />
                    <span className={styles.victorName}>{victor.displayName || victor.username}</span>
                    {getFlagUrl(victor.country) && (
                      <img src={getFlagUrl(victor.country)} alt={victor.country} className={styles.flagImg} loading="lazy" />
                    )}
                  </Link>
                  <div className={styles.victorMeta}>
                    <span className={styles.victorDate}>{formatDate(victor.completedAt)}</span>
                    {victor.videoURL && (
                      <a
                        href={victor.videoURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.videoLink}
                        aria-label={`Watch ${victor.displayName || victor.username || 'player'} completion video`}
                      >
                        <Youtube size={16} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {changes.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Changelog</h2>
            <div className={styles.changesList}>
              {changes.map((c, i) => (
                <motion.div
                  key={c.id}
                  className={styles.changeRow}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.02 }}
                >
                  <span className={styles.changeAction}>{changelogActionLabel(c.action)}</span>
                  <span className={styles.changeDetail}>
                    {c.action === 'added' && `Added at #${c.to ?? '—'}`}
                    {c.action === 'removed' && `Removed from #${c.from ?? '—'}`}
                    {c.action === 'moved' && `Moved #${c.from ?? '—'} → #${c.to ?? '—'}`}
                    {c.action === 'renumbered' && `Renumbered #${c.from ?? '—'} → #${c.to ?? '—'}`}
                    {!['added', 'removed', 'moved', 'renumbered'].includes(c.action) && (c.note || '')}
                  </span>
                  <span className={styles.changeDate}>{formatDate(c.createdAt)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
