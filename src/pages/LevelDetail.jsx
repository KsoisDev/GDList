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
import { getDocument, updateDocument } from '../services/firestore'
import { formatNumber, formatDate } from '../utils/format'
import { DIFFICULTIES, DIFFICULTY_COLORS, hasAccess } from '../utils/constants'
import styles from './LevelDetail.module.css'

export default function LevelDetail() {
  const { user, userData } = useAuth()
  const { levelId } = useParams()
  const [level, setLevel] = useState(null)
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
        if (data) {
          setEditFields({
            name: data.name || '',
            creator: data.creator || '',
            difficulty: data.difficulty || 'extreme',
            position: data.position || 0,
            points: data.points || 0,
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
      const newPoints = Number(editFields.points) || 0
      const diff = parseFloat((newPoints - (level.points || 0)).toFixed(2))

      await updateDocument('levels', levelId, {
        name: editFields.name,
        creator: editFields.creator,
        difficulty: editFields.difficulty,
        position: Number(editFields.position) || 0,
        points: newPoints,
      })

      if (diff !== 0 && (level.victors || []).length > 0) {
        const isMain = level?.type === 'main' || levelId?.startsWith('main_')
        const updates = (level.victors || []).map(victor =>
          getDocument('users', victor.userId).then(userDoc => {
            if (!userDoc) return
            const s = userDoc.stats || {}
            return updateDocument('users', victor.userId, {
              stats: {
                ...s,
                totalPoints: parseFloat(((s.totalPoints || 0) + diff).toFixed(2)),
                mainPoints: isMain ? parseFloat(((s.mainPoints || 0) + diff).toFixed(2)) : (s.mainPoints || 0),
                communityPoints: !isMain ? parseFloat(((s.communityPoints || 0) + diff).toFixed(2)) : (s.communityPoints || 0),
              },
            })
          })
        )
        await Promise.all(updates)
      }

      setLevel(prev => ({ ...prev, ...editFields, position: Number(editFields.position) || 0, points: newPoints }))
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

  return (
    <PageShell>
      <div className={styles.page}>
        <Link to="/list/main" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to Main List
        </Link>

        <Card padding="lg" className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.rankBadge}>
              <span className={styles.rankNumber}>#{level.position}</span>
            </div>
            <div className={styles.headerInfo}>
              <div className={styles.headerRow}>
                <h1 className={styles.levelName}>{level.name}</h1>
                {isAdmin && !editing && (
                  <button className={styles.editBtn} onClick={() => { setEditFields({ name: level.name, creator: level.creator, difficulty: level.difficulty, position: level.position, points: level.points }); setEditing(true) }}>
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
                <Badge variant="default" size="sm" style={{ color: diffColor, borderColor: diffColor }}>
                  {level.difficulty}
                </Badge>
                <span className={styles.metaText}>by {level.creator}</span>
                {level.verifier && level.verifier !== 'Unknown' && (
                  <span className={styles.metaText}>Verified by {level.verifier}</span>
                )}
              </div>
              {isAdmin && editing && (
                <div className={styles.editFields}>
                  <Input label="Name" value={editFields.name} onChange={e => setEditFields({ ...editFields, name: e.target.value })} />
                  <Input label="Creator" value={editFields.creator} onChange={e => setEditFields({ ...editFields, creator: e.target.value })} />
                  <Select label="Difficulty" options={diffOptions} value={editFields.difficulty} onChange={e => setEditFields({ ...editFields, difficulty: e.target.value })} />
                  <Input label="Position" type="number" value={editFields.position} onChange={e => setEditFields({ ...editFields, position: e.target.value })} />
                  <Input label="Points" type="number" value={editFields.points} onChange={e => setEditFields({ ...editFields, points: e.target.value })} />
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
                  transition={{ delay: i * 0.03 }}
                >
                  <Link to={`/profile/${victor.userId}`} className={styles.victorInfo}>
                    <Avatar src={victor.avatarURL} alt={victor.username} size="sm" />
                    <span className={styles.victorName}>{victor.username}</span>
                  </Link>
                  <div className={styles.victorMeta}>
                    <span className={styles.victorDate}>{formatDate(victor.completedAt)}</span>
                    {victor.videoURL && (
                      <a href={victor.videoURL} target="_blank" rel="noopener noreferrer" className={styles.videoLink}>
                        <Youtube size={16} />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
