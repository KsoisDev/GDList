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
import { DIFFICULTIES, DIFFICULTY_COLORS } from '../../utils/constants'
import { formatDateRelative } from '../../utils/format'
import styles from './Admin.module.css'

const emptyConfig = { difficulty: 'extreme', points: 0, position: 0, externalUrl: '' }

export default function ReviewSubmissions() {
  const { user, userData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState({})
  const [config, setConfig] = useState({})
  const [processing, setProcessing] = useState({})

  useEffect(() => {
    if (!authLoading && (!user || userData?.role !== 'admin')) navigate('/')
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
          let levelName = 'Unknown'
          if (sub.manualLevelName) {
            levelName = sub.manualLevelName
          } else if (sub.levelId) {
            const level = await getDocument('levels', sub.levelId)
            levelName = level?.name || 'Unknown'
          }
          const submitter = await getDocument('users', sub.userId)
          return { ...sub, levelName, submitterName: submitter?.username || 'Unknown' }
        })
      )
      setSubmissions(enriched)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (userData?.role === 'admin') loadSubmissions() }, [userData])

  const initConfig = (subId, sub) => {
    if (config[subId]) return
    setConfig(prev => ({
      ...prev,
      [subId]: {
        difficulty: sub.adminLevelConfig?.difficulty || 'extreme',
        points: sub.adminLevelConfig?.points || 0,
        position: sub.adminLevelConfig?.position || 0,
        externalUrl: sub.externalUrl || '',
      },
    }))
  }

  const handleReview = async (subId, status) => {
    setProcessing(prev => ({ ...prev, [subId]: true }))
    try {
      const sub = submissions.find(s => s.id === subId)
      const cfg = config[subId] || emptyConfig

      const updateData = {
        status,
        reviewNote: note[subId] || '',
        reviewedBy: user.uid,
        reviewedAt: new Date(),
      }

      if (status === 'approved' && sub.manualLevelName && cfg.points > 0) {
        updateData.adminLevelConfig = {
          difficulty: cfg.difficulty,
          points: Number(cfg.points),
          position: Number(cfg.position),
        }
        if (cfg.externalUrl) updateData.externalUrl = cfg.externalUrl
      }

      await updateDocument('submissions', subId, updateData)

      if (status === 'approved') {
        let levelId = sub.levelId
        let points = 0
        let levelName = sub.levelName

        if (sub.manualLevelName) {
          const sanitized = sub.manualLevelName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
          levelId = `manual_${sanitized}`
          points = Number(cfg.points) || 0

          const existing = await getDocument('levels', levelId)
          if (!existing) {
            await createDocument('levels', levelId, {
              type: 'main',
              position: Number(cfg.position) || 999,
              name: sub.manualLevelName,
              creator: 'Unknown',
              verifier: 'Unknown',
              difficulty: cfg.difficulty,
              points,
              thumbnail: '',
              players: 0,
              percentage: 100,
              isActive: true,
            })
          }
          levelName = sub.manualLevelName
          await updateDocument('submissions', subId, { levelId })
        } else {
          const level = await getDocument('levels', sub.levelId)
          points = level?.points || 0
        }

        const userDoc = await getDocument('users', sub.userId)

        await createDocument('completions', null, {
          userId: sub.userId,
          levelId,
          levelType: sub.levelType,
          levelName,
          submissionId: subId,
          points,
          completedAt: new Date(),
        })

        const stats = userDoc?.stats || {}
        await updateDocument('users', sub.userId, {
          stats: {
            ...stats,
            totalPoints: (stats.totalPoints || 0) + points,
            [`${sub.levelType}Points`]: (stats[`${sub.levelType}Points`] || 0) + points,
            [`${sub.levelType}Completions`]: (stats[`${sub.levelType}Completions`] || 0) + 1,
          },
        })
      }

      await loadSubmissions()
      setNote(prev => ({ ...prev, [subId]: '' }))
      setConfig(prev => { const c = { ...prev }; delete c[subId]; return c })
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(prev => ({ ...prev, [subId]: false }))
    }
  }

  if (authLoading || loading) {
    return <PageShell><div className={styles.loading}><Spinner size="lg" /></div></PageShell>
  }

  const diffOptions = DIFFICULTIES.map(d => ({ value: d.id, label: d.label }))

  return (
    <PageShell title="Review Submissions" subtitle={`${submissions.length} pending submissions`}>
      {submissions.length === 0 ? (
        <Card padding="lg" className={styles.emptyCard}>
          <p>No pending submissions. Great work!</p>
        </Card>
      ) : (
        <div className={styles.submissionsList}>
          {submissions.map((sub, i) => (
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
                    {sub.manualLevelName && <Badge variant="gold" size="sm">Manual</Badge>}
                    <Badge variant={sub.levelType === 'main' ? 'green' : 'blue'} size="sm">
                      {sub.levelType}
                    </Badge>
                    <span className={styles.subUser}>by {sub.submitterName}</span>
                    <span className={styles.subDate}>{formatDateRelative(sub.createdAt)}</span>
                  </div>
                </div>

                <div className={styles.subVideo}>
                  <a href={sub.videoURL} target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary" size="sm" icon={ExternalLink}>
                      Watch Video
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

                {sub.manualLevelName && (
                  <div className={styles.adminConfig}>
                    <span className={styles.configLabel}>Configure Level</span>
                    <div className={styles.configGrid}>
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
                        label="Points"
                        type="number"
                        placeholder="e.g. 350"
                        value={config[sub.id]?.points ?? ''}
                        onChange={e => {
                          initConfig(sub.id, sub)
                          setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], points: e.target.value },
                          }))
                        }}
                      />
                      <Input
                        label="Position"
                        type="number"
                        placeholder="e.g. 800"
                        value={config[sub.id]?.position ?? ''}
                        onChange={e => {
                          initConfig(sub.id, sub)
                          setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], position: e.target.value },
                          }))
                        }}
                      />
                      <Input
                        label="External URL"
                        placeholder="https://aredl.net/..."
                        value={config[sub.id]?.externalUrl ?? sub.externalUrl ?? ''}
                        onChange={e => {
                          initConfig(sub.id, sub)
                          setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], externalUrl: e.target.value },
                          }))
                        }}
                      />
                    </div>
                  </div>
                )}

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
                      disabled={sub.manualLevelName && (!config[sub.id]?.points || Number(config[sub.id]?.points) <= 0)}
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
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
