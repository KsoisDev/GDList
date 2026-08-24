import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ExternalLink, Send, Youtube } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import SearchSelect from '../components/ui/SearchSelect'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { createDocument, getCollection, where } from '../services/firestore'
import { isValidVideoUrl } from '../utils/validators'
import styles from './SubmitRecord.module.css'

export default function SubmitRecord() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [levels, setLevels] = useState([])
  const [selectedLevelId, setSelectedLevelId] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [gameId, setGameId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) navigate('/login')
  }, [user, authLoading, navigate])

  useEffect(() => {
    let mounted = true

    async function loadLevels() {
      setLoading(true)
      setLoadError('')
      try {
        const data = await getCollection('levels', [where('type', '==', 'community')])
        if (mounted) {
          setLevels(data
            .filter(level => level.isActive !== false)
            .sort((a, b) => (a.position || Number.MAX_SAFE_INTEGER) - (b.position || Number.MAX_SAFE_INTEGER)))
        }
      } catch (loadFailure) {
        console.error('Failed to load Basement levels:', loadFailure)
        if (mounted) setLoadError('The Basement list could not be loaded. Try again later.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadLevels()
    return () => { mounted = false }
  }, [])

  const levelOptions = useMemo(() => levels.map(level => ({
    value: level.id,
    label: level.position > 0 ? `#${level.position} - ${level.name}` : level.name,
  })), [levels])

  if (authLoading) {
    return (
      <PageShell title="Submit Record">
        <div className={styles.loadingCenter}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  if (!user) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!selectedLevelId) {
      setError('Please select a level')
      return
    }
    if (!isValidVideoUrl(videoUrl)) {
      setError('Please provide a valid video URL (YouTube, Medal, TikTok or Google Drive)')
      return
    }

    setSubmitting(true)
    try {
      const [pending, completions] = await Promise.all([
        getCollection('submissions', [
          where('userId', '==', user.uid),
          where('status', '==', 'pending'),
        ]),
        getCollection('completions', [where('userId', '==', user.uid)]),
      ])

      const duplicatePending = pending.some(submission =>
        (submission.requestType || 'completion') === 'completion'
        && submission.levelType === 'community'
        && submission.levelId === selectedLevelId
      )
      if (duplicatePending) {
        setError('You already have a pending submission for this level.')
        return
      }

      const duplicateCompletion = completions.some(completion => completion.levelId === selectedLevelId)
      if (duplicateCompletion) {
        const levelName = levels.find(level => level.id === selectedLevelId)?.name || 'this level'
        setError(`You already have a verified completion for "${levelName}".`)
        return
      }

      await createDocument('submissions', null, {
        userId: user.uid,
        requestType: 'completion',
        levelType: 'community',
        levelId: selectedLevelId,
        videoURL: videoUrl,
        gameId: gameId.trim(),
        status: 'pending',
        reviewNote: '',
        reviewedBy: null,
        reviewedAt: null,
      })

      setSuccess(true)
      setSelectedLevelId('')
      setVideoUrl('')
      setGameId('')
    } catch (submitFailure) {
      console.error('Failed to submit record:', submitFailure)
      setError(submitFailure.message || 'The record could not be submitted.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <PageShell>
        <Card padding="lg" className={styles.successCard}>
          <h2 className={styles.successTitle}>Submission Sent!</h2>
          <p className={styles.successText}>
            Your Basement List record is pending review by an admin.
          </p>
          <div className={styles.successActions}>
            <Button variant="primary" onClick={() => setSuccess(false)}>Submit Another</Button>
            <Button variant="secondary" onClick={() => navigate('/profile')}>My Profile</Button>
          </div>
        </Card>
      </PageShell>
    )
  }

  const selectionError = error === 'Please select a level' ? error : ''
  const videoError = error.startsWith('Please provide a valid video URL') ? error : ''
  const hasFieldError = Boolean(selectionError || videoError)

  return (
    <PageShell title="Submit Record" subtitle="Submit a Basement List completion for verification">
      <div className={styles.container}>
        <Card padding="lg">
          <form onSubmit={handleSubmit} className={styles.form}>
            {loadError && <p className={styles.error} role="alert">{loadError}</p>}

            <SearchSelect
              label="Basement Level"
              placeholder="Search submitted levels..."
              options={levelOptions}
              value={selectedLevelId}
              onChange={event => {
                setSelectedLevelId(event.target.value || '')
                setError('')
              }}
              error={!selectedLevelId ? selectionError : ''}
              loading={loading}
            />

            <Link to="/submit-level" className={styles.manualToggle}>
              <ExternalLink size={18} />
              <span>
                <strong>Level not listed?</strong> Submit the level first
              </span>
              <span className={styles.manualArrow}>→</span>
            </Link>

            <Input
              label="Level ID (optional)"
              type="text"
              placeholder="e.g. 10565740"
              value={gameId}
              onChange={event => setGameId(event.target.value)}
            />

            <Input
              label="Video URL"
              type="url"
              placeholder="https://youtu.be/..."
              value={videoUrl}
              onChange={event => setVideoUrl(event.target.value)}
              icon={Youtube}
              error={!isValidVideoUrl(videoUrl) ? videoError : ''}
            />

            {error && !hasFieldError && <p className={styles.error} role="alert">{error}</p>}

            <Button type="submit" variant="primary" fullWidth loading={submitting} icon={Send}>
              Submit Record
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  )
}
