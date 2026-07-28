import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, X, ExternalLink } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { getCollection, updateDocument, getDocument, createDocument } from '../../services/firestore'
import { formatDateRelative } from '../../utils/format'
import { DIFFICULTIES, hasAccess } from '../../utils/constants'
import styles from './Admin.module.css'

const TABS = [
  { id: 'main', label: 'Main List' },
  { id: 'community', label: 'Community List' },
  { id: 'levels', label: 'Level Acceptance' },
]

const emptyConfig = { difficulty: 'extreme', points: 0, position: 0, externalUrl: '' }

export default function ReviewSubmissions() {
  const { user, userData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('main')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState({})
  const [config, setConfig] = useState({})
  const [processing, setProcessing] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && (!user || !hasAccess(userData?.role || 'user', 'admin'))) navigate('/')
  }, [user, userData, authLoading, navigate])

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      const all = await getCollection('submissions')
      const data = all
        .filter(s => s.status === 'pending')
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0
          const tb = b.createdAt?.toMillis?.() || 0
          return tb - ta
        })

      const enriched = await Promise.all(
        data.map(async (sub) => {
          let levelName = sub.demonName || sub.manualLevelName || sub.levelName || 'Unknown'
          if (!levelName || levelName === 'Unknown') {
            if (sub.levelId) {
              const level = await getDocument('levels', sub.levelId)
              levelName = level?.name || 'Unknown'
            }
          }
          const submitter = await getDocument('users', sub.userId)

          const suggestedPos = sub.demonPosition ? Number(sub.demonPosition) : 0
          const suggestedPoints = sub.adminLevelConfig?.points || (sub.demonPosition ? Math.max(1, 1001 - Number(sub.demonPosition)) : '')

          return {
            ...sub,
            levelName,
            submitterName: submitter?.username || 'Unknown',
            _initialConfig: {
              difficulty: sub.adminLevelConfig?.difficulty || 'extreme',
              points: suggestedPoints,
              position: sub.adminLevelConfig?.position || suggestedPos,
              creator: sub.adminLevelConfig?.creator || sub.demonCreator || sub.creator || 'Unknown',
              externalUrl: sub.externalUrl || '',
            },
          }
        })
      )
      setSubmissions(enriched)
      const initial = {}
      enriched.forEach(sub => { initial[sub.id] = { ...sub._initialConfig } })
      setConfig(initial)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (hasAccess(userData?.role || 'user', 'admin')) loadSubmissions() }, [userData])

  const filtered = submissions.filter(s => {
    if (tab === 'levels') return s.requestType === 'level'
    return (s.requestType || 'completion') === 'completion' && (s.levelType || 'main') === tab
  })

  const diffOptions = DIFFICULTIES.filter(d =>
    ['easy', 'medium', 'hard', 'insane', 'extreme'].includes(d.id)
  ).map(d => ({ value: d.id, label: d.label }))

  const isValidDemonlistUrl = (url) => {
    if (!url) return true
    return /^https?:\/\/(www\.)?demonlist\.org\//.test(url)
  }

  const handleReview = async (subId, status) => {
    setError('')
    setProcessing(prev => ({ ...prev, [subId]: true }))
    try {
      const sub = submissions.find(s => s.id === subId)
      const cfg = config[subId] || emptyConfig

      if (status === 'approved' && cfg.externalUrl && !isValidDemonlistUrl(cfg.externalUrl)) {
        setError('External URL must be from demonlist.org')
        setProcessing(prev => ({ ...prev, [subId]: false }))
        return
      }

      const updateData = {
        status,
        reviewNote: note[subId] || '',
        reviewedBy: user.uid,
        reviewedAt: new Date(),
      }

      if (status === 'approved') {
        updateData.adminLevelConfig = {
          difficulty: cfg.difficulty,
          points: Number(cfg.points) || 0,
          position: Number(cfg.position) || 0,
          creator: cfg.creator || 'Unknown',
        }
        if (cfg.externalUrl) updateData.externalUrl = cfg.externalUrl
      }

      await updateDocument('submissions', subId, updateData)

      await createDocument('notifications', null, {
        userId: sub.userId,
        type: status,
        levelName: sub.levelName,
        reviewNote: note[subId] || '',
        submissionId: subId,
        read: false,
      })

      if (status === 'approved' && sub.requestType === 'level') {
        const sanitized = (sub.levelName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        const levelId = `community_${sanitized}_${Date.now()}`

        await createDocument('levels', levelId, {
          type: 'community',
          name: sub.levelName || 'Unknown',
          creator: cfg.creator || 'Unknown',
          difficulty: cfg.difficulty,
          position: Number(cfg.position) || 999,
          points: 0,
          thumbnail: '',
          victoryCount: 0,
          victors: [],
          isActive: true,
        })

        await updateDocument('submissions', subId, { levelId })
      }

      if (status === 'approved' && sub.requestType !== 'level') {
        let levelId = sub.levelId
        const levelName = sub.levelName

        if (sub.demonApiId) {
          levelId = `main_${sub.demonApiId}`
        } else if (sub.manualLevelName) {
          levelId = `manual_${sub.manualLevelName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
        } else if (!levelId) {
          levelId = `unknown_${subId}`
        }

        const submitter = await getDocument('users', sub.userId)
        const submitterName = submitter?.username || 'Unknown'

        const existing = await getDocument('levels', levelId)
        const now = new Date()
        const points = Number(cfg.points) || 0

        if (existing) {
          const victors = existing.victors || []
          const alreadyVictor = victors.some(v => v.userId === sub.userId)
          if (!alreadyVictor) {
            await updateDocument('levels', levelId, {
              position: Number(cfg.position) || existing.position,
              difficulty: cfg.difficulty,
              points: points || existing.points,
              creator: cfg.creator || existing.creator,
              victoryCount: (existing.victoryCount || 0) + 1,
              victors: [...victors, {
                userId: sub.userId,
                username: submitterName,
                completionId: '',
                completedAt: now,
                videoURL: sub.videoURL || '',
              }],
            })
          }
          await updateDocument('submissions', subId, { levelId })
        } else {
          const victorEntry = {
            userId: sub.userId,
            username: submitterName,
            completionId: '',
            completedAt: now,
            videoURL: sub.videoURL || '',
          }
          const levelData = {
            type: sub.levelType || 'main',
            position: Number(cfg.position) || 999,
            name: levelName,
            creator: cfg.creator || sub.demonCreator || 'Unknown',
            verifier: sub.demonVerifier || 'Unknown',
            difficulty: cfg.difficulty,
            points: points || 0,
            thumbnail: '',
            victoryCount: 1,
            victors: [victorEntry],
            firstCompletedAt: now,
            isActive: true,
            percentage: 100,
          }
          await createDocument('levels', levelId, levelData)
          await updateDocument('submissions', subId, { levelId })
        }

        const completionId = await createDocument('completions', null, {
          userId: sub.userId,
          levelId,
          levelType: sub.levelType,
          levelName,
          submissionId: subId,
          points,
          videoURL: sub.videoURL || '',
          completedAt: now,
        })

        const levelDoc = await getDocument('levels', levelId)
        if (levelDoc) {
          const updatedVictor = (levelDoc.victors || []).map(v =>
            v.userId === sub.userId && !v.completionId
              ? { ...v, completionId }
              : v
          )
          await updateDocument('levels', levelId, { victors: updatedVictor })
        }

        const userDoc = await getDocument('users', sub.userId)
        const stats = userDoc?.stats || {}
        await updateDocument('users', sub.userId, {
          stats: {
            ...stats,
            totalPoints: parseFloat(((stats.totalPoints || 0) + points).toFixed(2)),
            [`${sub.levelType}Points`]: parseFloat(((stats[`${sub.levelType}Points`] || 0) + points).toFixed(2)),
            [`${sub.levelType}Completions`]: (stats[`${sub.levelType}Completions`] || 0) + 1,
          },
        })
      }

      await loadSubmissions()
      setNote(prev => ({ ...prev, [subId]: '' }))
      setConfig(prev => { const c = { ...prev }; delete c[subId]; return c })
    } catch (err) {
      setError(err.message)
      console.error(err)
    } finally {
      setProcessing(prev => ({ ...prev, [subId]: false }))
    }
  }

  if (authLoading || loading) {
    return <PageShell><div className={styles.loading}><Spinner size="lg" /></div></PageShell>
  }

  return (
    <PageShell title="Review Submissions" subtitle={`${filtered.length} pending in ${TABS.find(t => t.id === tab)?.label}`}>
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className={styles.tabCount}>
              {submissions.filter(s => {
                if (t.id === 'levels') return s.requestType === 'level'
                return (s.requestType || 'completion') === 'completion' && (s.levelType || 'main') === t.id
              }).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card padding="lg" className={styles.emptyCard}>
          <p>No pending submissions. Great work!</p>
        </Card>
      ) : (
        <div className={styles.submissionsList}>
          {filtered.map((sub, i) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card padding="md" className={styles.submissionCard}>
                <div className={styles.subHeader}>
                  <div className={styles.subInfo}>
                    <span className={styles.subLevel}>{sub.levelName}</span>
                    {sub.requestType === 'level' && <Badge variant="gold" size="sm">New Level</Badge>}
                    {sub.manualLevelName && <Badge variant="gold" size="sm">Manual</Badge>}
                    {sub.demonApiId && <Badge variant="default" size="sm">Pointercrate</Badge>}
                    <Badge variant={sub.levelType === 'main' ? 'green' : 'blue'} size="sm">
                      {sub.levelType || 'community'}
                    </Badge>
                    <span className={styles.subUser}>by {sub.submitterName}</span>
                    <span className={styles.subDate}>{formatDateRelative(sub.createdAt)}</span>
                  </div>
                </div>

                <div className={styles.subVideo}>
                  <a href={sub.videoURL} target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary" size="sm" icon={ExternalLink}>
                      {sub.requestType === 'level' ? 'Watch Showcase' : 'Watch Video'}
                    </Button>
                  </a>
                  {sub.externalUrl && (
                    <a href={sub.externalUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" icon={ExternalLink}>
                        Level Link
                      </Button>
                    </a>
                  )}
                </div>

                {sub.note && (
                  <div className={styles.subNote}>
                    <span className={styles.noteLabel}>Submitter note:</span>
                    <span className={styles.noteText}>{sub.note}</span>
                  </div>
                )}

                <div className={styles.adminConfig}>
                  <span className={styles.configLabel}>
                    {sub.requestType === 'level' ? 'Configure Level (no points)' : 'Configure Level'}
                  </span>
                  <div className={styles.configGrid}>
                    {sub.requestType === 'level' ? (
                      <>
                        <Select
                          label="Difficulty"
                          options={diffOptions}
                          value={config[sub.id]?.difficulty || 'extreme'}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], difficulty: e.target.value },
                          }))}
                        />
                        <Input
                          label="Position"
                          type="number"
                          placeholder="e.g. 1"
                          value={config[sub.id]?.position ?? ''}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], position: e.target.value },
                          }))}
                        />
                        <Input
                          label="Creator"
                          placeholder="e.g. Riot"
                          value={config[sub.id]?.creator ?? ''}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], creator: e.target.value },
                          }))}
                        />
                      </>
                    ) : (
                      <>
                        <Input
                          label="Points"
                          type="number"
                          placeholder="e.g. 350"
                          value={config[sub.id]?.points ?? ''}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], points: e.target.value },
                          }))}
                        />
                        <Input
                          label="Position"
                          type="number"
                          placeholder="e.g. 150"
                          value={config[sub.id]?.position ?? ''}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], position: e.target.value },
                          }))}
                        />
                        <Input
                          label="External URL"
                          placeholder="https://demonlist.org/..."
                          value={config[sub.id]?.externalUrl ?? sub.externalUrl ?? ''}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], externalUrl: e.target.value },
                          }))}
                        />
                        <Input
                          label="Creator"
                          placeholder="e.g. Riot"
                          value={config[sub.id]?.creator ?? ''}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], creator: e.target.value },
                          }))}
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.subActions}>
                  <input
                    className={styles.noteInput}
                    placeholder="Optional review note..."
                    value={note[sub.id] || ''}
                    onChange={e => setNote({ ...note, [sub.id]: e.target.value })}
                  />
                  <div className={styles.actionBtns}>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Check}
                      onClick={() => handleReview(sub.id, 'approved')}
                      disabled={sub.requestType !== 'level' && config[sub.id]?.points !== '' && Number(config[sub.id]?.points) <= 0}
                      loading={processing[sub.id]}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={X}
                      onClick={() => handleReview(sub.id, 'rejected')}
                      loading={processing[sub.id]}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
                {error && <p className={styles.error}>{error}</p>}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
