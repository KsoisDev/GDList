import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Youtube, User, FileText } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { createDocument } from '../services/firestore'
import { isValidYouTubeUrl } from '../utils/validators'
import styles from './SubmitLevel.module.css'

export default function SubmitLevel() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [levelName, setLevelName] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [creator, setCreator] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) navigate('/login')
  }, [user, authLoading, navigate])

  if (authLoading) {
    return (
      <PageShell title="Submit Level">
        <div className={styles.loadingCenter}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  if (!user) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!levelName.trim()) { setError('Please enter the level name'); return }
    if (!isValidYouTubeUrl(videoUrl)) { setError('Please provide a valid YouTube URL'); return }
    if (!creator.trim()) { setError('Please enter the creator name'); return }

    setSubmitting(true)
    try {
      await createDocument('submissions', null, {
        userId: user.uid,
        requestType: 'level',
        levelType: 'community',
        levelName: levelName.trim(),
        videoURL: videoUrl,
        creator: creator.trim(),
        note: note.trim(),
        status: 'pending',
        reviewNote: '',
        reviewedBy: null,
        reviewedAt: null,
      })
      setSuccess(true)
      setLevelName('')
      setVideoUrl('')
      setCreator('')
      setNote('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <PageShell>
        <Card padding="lg" className={styles.successCard}>
          <h2 className={styles.successTitle}>Level Submitted!</h2>
          <p className={styles.successText}>
            Your level has been submitted and is pending review by an admin.
          </p>
          <div className={styles.successActions}>
            <Button variant="primary" onClick={() => setSuccess(false)}>
              Submit Another
            </Button>
            <Button variant="secondary" onClick={() => navigate('/profile')}>
              My Profile
            </Button>
          </div>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell title="Submit Level" subtitle="Submit a new level for the community demon list">
      <div className={styles.container}>
        <Card padding="lg">
          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Level Name"
              placeholder="e.g. Bloodbath"
              value={levelName}
              onChange={e => setLevelName(e.target.value)}
              error={error && !levelName.trim() ? error : ''}
            />
            <Input
              label="Creator"
              placeholder="e.g. Riot"
              value={creator}
              onChange={e => setCreator(e.target.value)}
              icon={User}
              error={error && !creator.trim() ? error : ''}
            />
            <Input
              label="Showcase YouTube URL"
              type="url"
              placeholder="https://youtu.be/..."
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              icon={Youtube}
              error={error && !isValidYouTubeUrl(videoUrl) ? error : ''}
            />
            <Input
              label="Note for Admin (optional)"
              placeholder="Any additional information..."
              value={note}
              onChange={e => setNote(e.target.value)}
              icon={FileText}
            />

            {error && <p className={styles.error}>{error}</p>}

            <Button type="submit" variant="primary" fullWidth loading={submitting} icon={Send}>
              Submit Level
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  )
}
