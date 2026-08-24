import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Send, Tags, Youtube, User, FileText, Video } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import ThemedPageHero from '../components/layout/ThemedPageHero'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { getCollection, where, createDocument } from '../services/firestore'
import { isValidVideoUrl } from '../utils/validators'
import styles from './SubmitLevel.module.css'
import theme from '../components/layout/ThemedPage.module.css'

export default function SubmitLevel() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [levelName, setLevelName] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [creator, setCreator] = useState('')
  const [note, setNote] = useState('')
  const [gameId, setGameId] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [tags, setTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) navigate('/login')
  }, [user, authLoading, navigate])

  useEffect(() => {
    let mounted = true
    getCollection('tags')
      .then(data => { if (mounted) setTags(data) })
      .catch(err => console.error('Failed to load tags:', err))
    return () => { mounted = false }
  }, [])

  if (authLoading) {
    return (
      <PageShell className={theme.pageShell}>
        <div className={theme.glow} aria-hidden="true" />
        <div className={styles.loadingCenter}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  if (!user) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!levelName.trim()) { setError('Please enter the level name'); return }
    if (!isValidVideoUrl(videoUrl)) { setError('Please provide a valid video URL (YouTube, Medal, TikTok or Google Drive)'); return }
    if (!creator.trim()) { setError('Please enter the creator name'); return }

    try {
      const name = levelName.trim().toLowerCase()
      const existing = await getCollection('levels', [where('type', '==', 'community')])
      if (existing.some(l => (l.name || '').toLowerCase() === name)) {
        setError('A level with this name is already on the community list.')
        return
      }
      const pending = await getCollection('submissions', [
        where('userId', '==', user.uid),
        where('requestType', '==', 'level'),
        where('status', '==', 'pending'),
      ])
      if (pending.some(s => (s.levelName || '').toLowerCase() === name)) {
        setError('You already have a pending submission for a level with this name.')
        return
      }
    } catch (err) {
      console.warn('Duplicate check failed, continuing:', err)
    }

    setSubmitting(true)
    try {
      await createDocument('submissions', null, {
        userId: user.uid,
        requestType: 'level',
        levelType: 'community',
        levelName: levelName.trim(),
        videoURL: videoUrl,
        creator: creator.trim(),
        gameId: gameId.trim(),
        note: note.trim(),
        isVerified,
        tags: selectedTags,
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
      setGameId('')
      setIsVerified(false)
      setSelectedTags([])
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <PageShell className={theme.pageShell}>
        <div className={theme.glow} aria-hidden="true" />
        <Card padding="lg" className={`${styles.successCard} ${theme.successSurface}`}>
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
    <PageShell className={theme.pageShell}>
      <div className={theme.glow} aria-hidden="true" />
      <ThemedPageHero
        eyebrow="ADD TO THE COMMUNITY LIST"
        title="Submit a"
        accentTitle="Level"
        description="Share a new Geometry Dash challenge with the Basement community and send it to the review team for placement."
        stats={[
          { icon: Video, value: 'Showcase proof', label: 'Attach a supported video' },
          { icon: Tags, value: 'Level details', label: 'Creator, ID and tags stay intact' },
          { icon: BadgeCheck, value: 'Review queue', label: 'Admins verify every submission', featured: true },
        ]}
      />

      <section className={`${theme.surface} ${theme.formSurface}`} aria-label="Level submission form">
        <div className={theme.surfaceHeading}>
          <div>
            <span className={theme.sectionLabel}>NEW COMMUNITY LEVEL</span>
            <h2>Level details</h2>
          </div>
        </div>
        <div className={`${styles.container} ${theme.formContainer}`}>
        <Card padding="lg" className={theme.innerCard}>
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
              label="Showcase Video URL"
              type="url"
              placeholder="https://youtu.be/..., https://medal.tv/..., https://tiktok.com/..., https://drive.google.com/..."
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              icon={Youtube}
              error={error && !isValidVideoUrl(videoUrl) ? error : ''}
            />
            <Input
              label="Level ID (in-game)"
              placeholder="e.g. 10565740"
              value={gameId}
              onChange={e => setGameId(e.target.value)}
            />
            <Input
              label="Note for Admin (optional)"
              placeholder="Any additional information..."
              value={note}
              onChange={e => setNote(e.target.value)}
              icon={FileText}
            />

            <label className={`${styles.verifiedRow} ${isVerified ? styles.verifiedChecked : ''}`}>
              <input
                type="checkbox"
                checked={isVerified}
                onChange={e => setIsVerified(e.target.checked)}
              />
              <span className={styles.verifiedBox}>
                <svg viewBox="0 0 12 12" className={styles.verifiedMark}>
                  <path d="M1.5 6.5 4.5 9.5 10.5 2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className={styles.verifiedLabel}>
                This level is already verified<span className={styles.verifiedHint}> (submitted video is the verification)</span>
              </span>
            </label>

            {tags.length > 0 && (
              <div className={styles.tagsField}>
                <span className={styles.tagsLabel}>Tags</span>
                <div className={styles.tagsRow} role="group" aria-label="Choose level tags">
                  {tags.map(tag => {
                    const active = selectedTags.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={`${styles.tagChip} ${active ? styles.tagChipActive : ''}`}
                        style={active ? { background: tag.color, borderColor: tag.color } : undefined}
                        onClick={() => setSelectedTags(prev =>
                          active ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                        )}
                        aria-pressed={active}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {error && <p className={styles.error} role="alert">{error}</p>}

            <Button type="submit" variant="primary" fullWidth loading={submitting} icon={Send}>
              Submit Level
            </Button>
          </form>
        </Card>
        </div>
      </section>
    </PageShell>
  )
}
