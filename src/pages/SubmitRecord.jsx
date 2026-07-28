import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Youtube, Send, ExternalLink } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import SearchSelect from '../components/ui/SearchSelect'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { getCollection, where, createDocument } from '../services/firestore'
import { fetchListedDemons } from '../services/gdl'
import { isValidYouTubeUrl } from '../utils/validators'
import styles from './SubmitRecord.module.css'

export default function SubmitRecord() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [levelType, setLevelType] = useState('main')
  const [selectedDemon, setSelectedDemon] = useState(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [demons, setDemons] = useState([])
  const [communityLevels, setCommunityLevels] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualLevelName, setManualLevelName] = useState('')
  const [externalUrl, setExternalUrl] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  if (authLoading) {
    return (
      <PageShell title="Submit Record">
        <div className={styles.loadingCenter}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  if (!user) return null

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setLoadError('')
      setSelectedDemon(null)
      setManualMode(false)
      setManualLevelName('')
      setExternalUrl('')
      try {
        if (levelType === 'community') {
          const data = await getCollection('levels', [where('type', '==', 'community')])
          if (mounted) setCommunityLevels(data.filter(l => l.isActive !== false).sort((a, b) => a.position - b.position))
        } else {
          const data = await fetchListedDemons(100)
          if (mounted) setDemons(data)
        }
      } catch (err) {
        setLoadError('Failed to load levels. Try again later.')
        console.error('Failed to load levels:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
  }, [levelType])

  const isValidExternalUrl = (url) => {
    if (!url) return true
    return /^https?:\/\/(www\.)?demonlist\.org\//.test(url)
  }

  const getLevelOptions = () => {
    if (levelType === 'community') {
      return communityLevels.map(l => ({
        value: l.id,
        label: `#${l.position} - ${l.name}`,
      }))
    }
    return demons.map(d => ({
      value: String(d.id),
      label: `#${d.position} - ${d.name}`,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!manualMode && levelType === 'main' && !selectedDemon) {
      setError('Please select a level')
      return
    }
    if (!manualMode && levelType === 'community' && !selectedDemon) {
      setError('Please select a level')
      return
    }
    if (manualMode && !manualLevelName.trim()) {
      setError('Please enter the level name')
      return
    }
    if (!isValidYouTubeUrl(videoUrl)) {
      setError('Please provide a valid YouTube URL')
      return
    }
    if (externalUrl && !isValidExternalUrl(externalUrl)) {
      setError('Link must be from demonlist.org')
      return
    }

    setSubmitting(true)
    try {
      const data = {
        userId: user.uid,
        levelType,
        videoURL: videoUrl,
        status: 'pending',
        reviewNote: '',
        reviewedBy: null,
        reviewedAt: null,
      }

      if (manualMode) {
        data.manualLevelName = manualLevelName.trim()
        if (externalUrl) data.externalUrl = externalUrl
      } else if (levelType === 'main' && selectedDemon) {
        data.demonName = selectedDemon.name
        data.demonPosition = selectedDemon.position
        data.demonApiId = String(selectedDemon.id)
        data.demonCreator = selectedDemon.publisher?.name || (selectedDemon.creators?.[0]?.name) || 'Unknown'
        data.demonVerifier = selectedDemon.verifier?.name || 'Unknown'
      } else if (levelType === 'community' && selectedDemon) {
        data.levelId = selectedDemon
      }

      await createDocument('submissions', null, data)
      setSuccess(true)
      setSelectedDemon(null)
      setVideoUrl('')
      setManualLevelName('')
      setExternalUrl('')
      setManualMode(false)
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
          <h2 className={styles.successTitle}>Submission Sent!</h2>
          <p className={styles.successText}>
            Your record has been submitted and is pending review by an admin.
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

  const levelOptions = getLevelOptions()

  return (
    <PageShell title="Submit Record" subtitle="Submit a demon completion for verification">
      <div className={styles.container}>
        <Card padding="lg">
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.typeToggle}>
              <button
                type="button"
                className={`${styles.typeBtn} ${levelType === 'main' ? styles.active : ''}`}
                onClick={() => setLevelType('main')}
              >
                Main List
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${levelType === 'community' ? styles.active : ''}`}
                onClick={() => setLevelType('community')}
              >
                Community List
              </button>
            </div>

            {loadError && (
              <p className={styles.error}>{loadError}</p>
            )}

            {!manualMode ? (
              <>
                <SearchSelect
                  label="Level"
                  placeholder="Search for a level..."
                  options={levelOptions}
                  value={levelType === 'main' ? (selectedDemon ? String(selectedDemon.id) : '') : (selectedDemon || '')}
                  onChange={e => {
                    if (levelType === 'main') {
                      const demon = demons.find(d => String(d.id) === e.target.value)
                      setSelectedDemon(demon || null)
                    } else {
                      setSelectedDemon(e.target.value || null)
                    }
                  }}
                  error={error && !selectedDemon ? error : ''}
                  loading={loading}
                />
                {levelType === 'community' ? (
                  <Link to="/submit-level" className={styles.manualToggle}>
                    <ExternalLink size={18} />
                    <span>
                      <strong>Level not listed?</strong> Submit the level
                    </span>
                    <span className={styles.manualArrow}>→</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.manualToggle}
                    onClick={() => setManualMode(true)}
                  >
                    <ExternalLink size={18} />
                    <span>
                      <strong>Level not listed?</strong> Enter it manually
                    </span>
                    <span className={styles.manualArrow}>→</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <div className={styles.manualHeader}>
                  <span className={styles.manualLabel}>Manual Entry</span>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => setManualMode(false)}
                  >
                    Back to search
                  </button>
                </div>
                <Input
                  label="Level Name"
                  placeholder="e.g. Bloodbath"
                  value={manualLevelName}
                  onChange={e => setManualLevelName(e.target.value)}
                  error={error && !manualLevelName.trim() ? error : ''}
                />
                <Input
                  label="Link (optional) — demonlist.org"
                  type="url"
                  placeholder="https://demonlist.org/list/..."
                  value={externalUrl}
                  onChange={e => setExternalUrl(e.target.value)}
                  icon={ExternalLink}
                  error={externalUrl && !isValidExternalUrl(externalUrl) ? 'Must be from demonlist.org' : ''}
                />
              </>
            )}

            <Input
              label="YouTube Video URL"
              type="url"
              placeholder="https://youtu.be/..."
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              icon={Youtube}
              error={error && !isValidYouTubeUrl(videoUrl) ? error : ''}
            />

            {error && (
              <p className={styles.error}>{error}</p>
            )}

            <Button type="submit" variant="primary" fullWidth loading={submitting} icon={Send}>
              Submit Record
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  )
}
