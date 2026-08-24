import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { Check, X, RefreshCw, ExternalLink } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../services/firebase'
import { getCollection, updateDocument, getDocument, createDocument } from '../../services/firestore'
import { insertCommunityLevel, setCommunityPosition } from '../../services/communityList'
import { findMainLevelByName } from '../../services/mainLevels'
import { lookupAredlLevel } from '../../services/aredl'
import { communityPoints } from '../../utils/communityPoints'
import { formatDateRelative, parseDecimal, getDisplayName } from '../../utils/format'
import { hasAccess } from '../../utils/constants'
import styles from './Admin.module.css'

const TABS = [
  { id: 'main', label: 'Main List' },
  { id: 'community', label: 'Community List' },
  { id: 'levels', label: 'Level Acceptance' },
]

const emptyConfig = { difficulty: 'extreme', points: 0, position: 0, externalUrl: '', creator: 'Unknown', gameId: '', sendTo: 'unverified' }

async function claimSubmission(submissionId, reviewerId) {
  const submissionRef = doc(db, 'submissions', submissionId)
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(submissionRef)
    if (!snapshot.exists()) throw new Error('This submission no longer exists.')
    if (snapshot.data().status !== 'pending') {
      throw new Error('This submission is already being reviewed or has been resolved.')
    }
    transaction.update(submissionRef, {
      status: 'reviewing',
      reviewClaimedBy: reviewerId,
      reviewClaimedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

async function releaseSubmissionClaim(submissionId, reviewerId) {
  const submissionRef = doc(db, 'submissions', submissionId)
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(submissionRef)
    if (!snapshot.exists()) return
    const data = snapshot.data()
    if (data.status !== 'reviewing' || data.reviewClaimedBy !== reviewerId) return
    transaction.update(submissionRef, {
      status: 'pending',
      reviewClaimedBy: null,
      reviewClaimedAt: null,
      updatedAt: serverTimestamp(),
    })
  })
}

async function finalizeSubmissionReview({
  submissionId,
  reviewerId,
  status,
  reviewData,
  notification,
}) {
  const submissionRef = doc(db, 'submissions', submissionId)
  const notificationRef = doc(db, 'notifications', `review_${submissionId}`)

  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(submissionRef)
    if (!snapshot.exists()) throw new Error('This submission no longer exists.')
    const data = snapshot.data()
    if (data.status !== 'reviewing' || data.reviewClaimedBy !== reviewerId) {
      throw new Error('The review claim was lost. Reload the queue before trying again.')
    }

    transaction.update(submissionRef, {
      ...reviewData,
      status,
      reviewClaimedBy: null,
      reviewClaimedAt: null,
      reviewedBy: reviewerId,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    transaction.set(notificationRef, {
      ...notification,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export default function ReviewSubmissions() {
  const { user, userData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('main')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState({})
  const [config, setConfig] = useState({})
  const [processing, setProcessing] = useState({})
  const [autoFill, setAutoFill] = useState({})
  const [error, setError] = useState('')
  const inFlightRef = useRef(new Set())

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

          const existingLevel = sub.levelType === 'community' && sub.levelId
            ? await getDocument('levels', sub.levelId)
            : null

          const suggestedPos = sub.demonPosition ? Number(sub.demonPosition) : 0
          const isCommunitySub = sub.levelType === 'community' || sub.requestType === 'level'
          const aredlLevel = sub.demonApiId ? await lookupAredlLevel(sub.demonApiId) : null
          const suggestedPoints = isCommunitySub
            ? ''
            : (sub.adminLevelConfig?.points
                || (aredlLevel?.points != null ? aredlLevel.points : (sub.demonPosition ? Math.max(1, 1001 - Number(sub.demonPosition)) : '')))

          return {
            ...sub,
            levelName,
            submitterName: getDisplayName(submitter),
            _existingLevel: existingLevel,
            _initialConfig: {
              difficulty: sub.adminLevelConfig?.difficulty || existingLevel?.difficulty || 'extreme',
              points: suggestedPoints,
              position: sub.adminLevelConfig?.position || existingLevel?.position || suggestedPos,
              creator: sub.adminLevelConfig?.creator || existingLevel?.creator || sub.demonCreator || sub.creator || 'Unknown',
              externalUrl: sub.externalUrl || '',
              gameId: sub.adminLevelConfig?.gameId || existingLevel?.gameId || sub.demonGameId || sub.gameId || '',
              sendTo: (existingLevel?.victoryCount || sub.isVerified) ? 'active' : 'unverified',
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

  const isValidDemonlistUrl = (url) => {
    if (!url) return true
    return /^https?:\/\/(www\.)?demonlist\.org\//.test(url)
  }

  const handleReview = async (subId, status) => {
    if (processing[subId] || inFlightRef.current.has(subId)) return
    inFlightRef.current.add(subId)
    setError('')
    setProcessing(prev => ({ ...prev, [subId]: true }))
    let claimed = false
    try {
      const sub = submissions.find(s => s.id === subId)
      if (!sub) throw new Error('This submission is no longer in the review queue.')
      const cfg = config[subId]
        || (sub._existingLevel
          ? {
              ...emptyConfig,
              difficulty: sub._existingLevel.difficulty || 'extreme',
              creator: sub._existingLevel.creator || 'Unknown',
              gameId: sub._existingLevel.gameId || '',
              position: 0,
              points: 0,
              externalUrl: sub.externalUrl || '',
            }
          : emptyConfig)

      if (status === 'approved' && cfg.externalUrl && !isValidDemonlistUrl(cfg.externalUrl)) {
        setError('External URL must be from demonlist.org')
        return
      }

      const reviewData = {
        reviewNote: note[subId] || '',
      }

      if (status === 'approved') {
        reviewData.adminLevelConfig = {
          difficulty: cfg.difficulty,
          points: parseDecimal(cfg.points) || 0,
          position: Number(cfg.position) || 0,
          creator: cfg.creator || 'Unknown',
          gameId: cfg.gameId || sub.demonGameId || '',
        }
        if (cfg.externalUrl) reviewData.externalUrl = cfg.externalUrl
      }

      await claimSubmission(subId, user.uid)
      claimed = true

      if (status === 'approved' && sub.requestType === 'level') {
        const sanitized = (sub.levelName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        const levelId = sub.levelId || `community_${sanitized}_${subId}`
        const sendToActive = cfg.sendTo === 'active'
        const now = new Date()

        const submitter = await getDocument('users', sub.userId)
        const submitterName = getDisplayName(submitter)

        const levelData = {
          type: 'community',
          name: sub.levelName || 'Unknown',
          creator: cfg.creator || sub.creator || 'Unknown',
          gameId: cfg.gameId || sub.gameId || '',
          thumbnail: '',
          videoURL: sub.videoURL || '',
          tags: sub.tags || [],
          isActive: true,
        }

        if (sendToActive) {
          levelData.victoryCount = 1
          levelData.victors = [{
            userId: sub.userId,
            username: submitterName,
            displayName: submitterName,
            country: submitter?.country || '',
            completionId: '',
            completedAt: now,
            videoURL: sub.videoURL || '',
          }]
          levelData.firstCompletedAt = now
        } else {
          levelData.victoryCount = 0
          levelData.victors = []
        }

        await insertCommunityLevel(
          levelId,
          levelData,
          cfg.position && Number(cfg.position) > 0 ? Number(cfg.position) : undefined
        )

        await updateDocument('submissions', subId, { levelId })

        if (sendToActive) {
          const inserted = await getDocument('levels', levelId)
          const position = (inserted?.position && Number(inserted.position) > 0)
            ? Number(inserted.position)
            : (Number(cfg.position) || 999)
          const points = communityPoints(position)
          const completionId = `completion_${subId}`
          await createDocument('completions', completionId, {
            userId: sub.userId,
            levelId,
            levelType: 'community',
            levelName: sub.levelName || 'Unknown',
            submissionId: subId,
            points,
            videoURL: sub.videoURL || '',
            completedAt: now,
          })

          await updateDocument('levels', levelId, {
            victors: [{
              userId: sub.userId,
              username: submitterName,
              completionId,
              completedAt: now,
              videoURL: sub.videoURL || '',
            }],
          })

          const userDoc = await getDocument('users', sub.userId)
          const udStats = userDoc?.stats || {}
          await updateDocument('users', sub.userId, {
            stats: {
              ...udStats,
              totalPoints: parseFloat(((udStats.totalPoints || 0) + points).toFixed(2)),
              communityPoints: parseFloat(((udStats.communityPoints || 0) + points).toFixed(2)),
              communityCompletions: (udStats.communityCompletions || 0) + 1,
            },
          })
        }
      }

      if (status === 'approved' && sub.requestType !== 'level') {
        let levelId = sub.levelId
        const levelName = sub.levelName
        const isCommunity = sub.levelType === 'community'

        if (sub.demonApiId) {
          levelId = `main_${sub.demonApiId}`
        } else if (sub.manualLevelName) {
          levelId = `manual_${sub.manualLevelName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
        } else if (!levelId) {
          levelId = `unknown_${subId}`
        }

        const submitter = await getDocument('users', sub.userId)
        const submitterName = getDisplayName(submitter)

        let existing = await getDocument('levels', levelId)

        if (!existing && !isCommunity && levelName && levelName !== 'Unknown') {
          const byName = await findMainLevelByName(levelName)
          if (byName) {
            levelId = byName.id
            existing = byName
          }
        }

        const now = new Date()
        let points = 0
        let alreadyVictor = false

        if (existing) {
          let finalPosition = existing.position || 0
          if (isCommunity) {
            const wasVerified = (existing.victoryCount || 0) > 0
            const targetPos = Number(cfg.position) || 0
            if (!wasVerified || (targetPos > 0 && targetPos !== (existing.position || 0))) {
              await setCommunityPosition(levelId, targetPos)
              const refreshed = await getDocument('levels', levelId)
              finalPosition = refreshed ? (refreshed.position || finalPosition) : finalPosition
            }
            points = communityPoints(finalPosition)
          } else {
            finalPosition = Number(cfg.position) || finalPosition
            points = parseDecimal(cfg.points) || existing.points
          }

          const victors = existing.victors || []
          alreadyVictor = victors.some(v => v.userId === sub.userId)
          let newLevelPoints = points || existing.points
          if (!alreadyVictor) {
            await updateDocument('levels', levelId, {
              position: finalPosition,
              difficulty: cfg.difficulty,
              points: newLevelPoints,
              creator: cfg.creator || existing.creator,
              victoryCount: (existing.victoryCount || 0) + 1,
              victors: [...victors, {
                userId: sub.userId,
                username: submitterName,
                displayName: submitterName,
                country: submitter?.country || '',
                completionId: '',
                completedAt: now,
                videoURL: sub.videoURL || '',
              }],
            })
          }
          await updateDocument('submissions', subId, { levelId })

          const pointsDiff = parseFloat((newLevelPoints - (existing.points || 0)).toFixed(2))
          const prevVictors = (existing.victors || []).filter(v => v.userId !== sub.userId)
          if (pointsDiff !== 0 && prevVictors.length > 0) {
            const pointsField = isCommunity ? 'communityPoints' : 'mainPoints'
            const updates = prevVictors.map(victor =>
              getDocument('users', victor.userId).then(userDoc => {
                if (!userDoc) return
                const s = userDoc.stats || {}
                return updateDocument('users', victor.userId, {
                  stats: {
                    ...s,
                    totalPoints: parseFloat(((s.totalPoints || 0) + pointsDiff).toFixed(2)),
                    [pointsField]: parseFloat(((s[pointsField] || 0) + pointsDiff).toFixed(2)),
                  },
                })
              })
            )
            await Promise.all(updates)
          }
        } else {
          const victorEntry = {
            userId: sub.userId,
            username: submitterName,
            displayName: submitterName,
            country: submitter?.country || '',
            completionId: '',
            completedAt: now,
            videoURL: sub.videoURL || '',
          }
          const levelData = {
            type: sub.levelType || 'main',
            name: levelName,
            creator: cfg.creator || sub.demonCreator || 'Unknown',
            verifier: sub.demonVerifier || 'Unknown',
            difficulty: cfg.difficulty,
            gameId: cfg.gameId || sub.demonGameId || '',
            thumbnail: '',
            victoryCount: 1,
            victors: [victorEntry],
            firstCompletedAt: now,
            isActive: true,
            percentage: 100,
          }
          if (isCommunity) {
            const targetPos = (cfg.position && Number(cfg.position) > 0) ? Number(cfg.position) : 999
            points = communityPoints(targetPos)
            await insertCommunityLevel(levelId, levelData, targetPos)
          } else {
            points = parseDecimal(cfg.points) || 0
            await createDocument('levels', levelId, { ...levelData, position: Number(cfg.position) || 999, points })
          }
          await updateDocument('submissions', subId, { levelId })
        }

        const approvedGameId = cfg.gameId || sub.demonGameId || ''
        if (approvedGameId) {
          await updateDocument('levels', levelId, { gameId: approvedGameId })
        }

        if (!alreadyVictor) {
          const completionId = `completion_${subId}`
          await createDocument('completions', completionId, {
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
      }

      await finalizeSubmissionReview({
        submissionId: subId,
        reviewerId: user.uid,
        status,
        reviewData,
        notification: {
          userId: sub.userId,
          type: status,
          levelName: sub.levelName,
          reviewNote: note[subId] || '',
          submissionId: subId,
          read: false,
        },
      })
      claimed = false

      await loadSubmissions()
      setNote(prev => ({ ...prev, [subId]: '' }))
      setConfig(prev => { const c = { ...prev }; delete c[subId]; return c })
    } catch (err) {
      if (claimed) {
        try {
          await releaseSubmissionClaim(subId, user.uid)
        } catch (releaseError) {
          console.error('Failed to release submission review claim:', releaseError)
        }
      }
      setError(err.message)
      console.error(err)
    } finally {
      inFlightRef.current.delete(subId)
      setProcessing(prev => ({ ...prev, [subId]: false }))
    }
  }

  const handleAutoFill = async (subId) => {
    if (processing[subId] || autoFill[subId]) return
    setError('')
    setAutoFill(prev => ({ ...prev, [subId]: true }))
    try {
      const sub = submissions.find(s => s.id === subId)
      const level = await lookupAredlLevel(sub?.demonApiId)
      if (!level) {
        setError('Level not found in AREDL data')
        return
      }
      const creator = level.creators?.[0] || config[subId]?.creator || 'Unknown'
      const verifier = level.verifier || sub.demonVerifier || ''
      const position = Number(level.position) || 0
      const aredlPoints = level.points != null ? level.points : (position ? Math.max(1, 1001 - position) : 0)
      const prev = config[subId] || sub._initialConfig || emptyConfig

      setConfig(prevCfg => ({
        ...prevCfg,
        [subId]: {
          ...prev,
          creator,
          position: position || prev.position,
          points: prev.points !== '' && parseDecimal(prev.points) > 0
            ? prev.points
            : aredlPoints,
        },
      }))
      setSubmissions(prev => prev.map(s =>
        s.id === subId ? { ...s, demonCreator: creator, demonVerifier: verifier, demonPosition: position || s.demonPosition } : s
      ))
      await updateDocument('submissions', subId, {
        demonCreator: creator,
        demonVerifier: verifier,
        demonPosition: position || sub.demonPosition,
      })
    } catch (err) {
      console.error('Failed to auto-fill AREDL data:', err)
      setError('Failed to fetch AREDL data: ' + err.message)
    } finally {
      setAutoFill(prev => ({ ...prev, [subId]: false }))
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
            type="button"
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
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
              transition={{ delay: Math.min(i, 12) * 0.05 }}
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
                  <Button
                    href={sub.videoURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    size="sm"
                    icon={ExternalLink}
                  >
                    {sub.requestType === 'level' ? 'Watch Showcase' : 'Watch Video'}
                  </Button>
                  {sub.externalUrl && (
                    <Button
                      href={sub.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="ghost"
                      size="sm"
                      icon={ExternalLink}
                    >
                      Level Link
                    </Button>
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
                          label="Send to"
                          value={config[sub.id]?.sendTo ?? 'unverified'}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], sendTo: e.target.value },
                          }))}
                          options={[
                            { value: 'active', label: 'Active (verified)' },
                            { value: 'unverified', label: 'Levels to Verify' },
                          ]}
                        />
                        <Input
                          label="Level ID (in-game)"
                          placeholder="e.g. 10565740"
                          value={config[sub.id]?.gameId ?? ''}
                          onChange={e => setConfig(prev => ({
                            ...prev,
                            [sub.id]: { ...prev[sub.id], gameId: e.target.value },
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
                    ) : sub._existingLevel ? (
                      <div className={styles.autoInfo}>
                        <span className={styles.autoInfoRow}>
                          <span className={styles.autoInfoLabel}>Position</span>
                          <span className={styles.autoInfoValue}>#{sub._existingLevel.position}</span>
                        </span>
                        <span className={styles.autoInfoRow}>
                          <span className={styles.autoInfoLabel}>Creator</span>
                          <span className={styles.autoInfoValue}>{sub._existingLevel.creator}</span>
                        </span>
                        <span className={styles.autoInfoRow}>
                          <span className={styles.autoInfoLabel}>Points</span>
                          <span className={styles.autoInfoValue}>{sub._existingLevel.position ? communityPoints(sub._existingLevel.position) : '—'}</span>
                        </span>
                        <span className={styles.autoInfoRow}>
                          <span className={styles.autoInfoLabel}>Level ID</span>
                          <span className={styles.autoInfoValue}>{sub._existingLevel.gameId || '—'}</span>
                        </span>
                        {sub.externalUrl && (
                          <span className={styles.autoInfoRow}>
                            <span className={styles.autoInfoLabel}>Link</span>
                            <a href={sub.externalUrl} target="_blank" rel="noopener noreferrer" className={styles.autoInfoValue}>
                              {sub.externalUrl}
                            </a>
                          </span>
                        )}
                        <span className={styles.autoInfoNote}>
                          Auto config: uses the level's current position, creator and points. Approve directly.
                        </span>
                      </div>
                    ) : (
                      <>
                        {sub.levelType !== 'community' && (
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
                        )}
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
                        {sub.levelType === 'community' && (
                          <Input
                            label="Level ID (in-game)"
                            placeholder="e.g. 10565740"
                            value={config[sub.id]?.gameId ?? ''}
                            onChange={e => setConfig(prev => ({
                              ...prev,
                              [sub.id]: { ...prev[sub.id], gameId: e.target.value },
                            }))}
                          />
                        )}
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
                  {(sub.requestType !== 'level' && sub.levelType === 'main' && sub.dataSource === 'aredl') && (
                  <div className={styles.autoFillRow}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RefreshCw}
                      loading={autoFill[sub.id]}
                      disabled={processing[sub.id]}
                      onClick={() => handleAutoFill(sub.id)}
                    >
                      Auto-fill (AREDL)
                    </Button>
                    <span className={styles.autoFillHint}>Fetch creator, verifier and position from AREDL</span>
                  </div>
                )}
              </div>

              <div className={styles.subActions}>
                  <input
                    className={styles.noteInput}
                    placeholder="Optional review note..."
                    value={note[sub.id] || ''}
                    onChange={e => setNote({ ...note, [sub.id]: e.target.value })}
                    aria-label={`Review note for ${sub.levelName}`}
                  />
                  <div className={styles.actionBtns}>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Check}
                      onClick={() => handleReview(sub.id, 'approved')}
                      disabled={sub.requestType !== 'level' && config[sub.id]?.points !== '' && parseDecimal(config[sub.id]?.points) <= 0}
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
