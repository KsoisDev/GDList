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
import { getCollection, where, getDocument, createDocument } from '../services/firestore'
import { fetchListedDemons } from '../services/gdl'
import { fetchAredlLevels } from '../services/aredl'
import { findMainLevelByName } from '../services/mainLevels'
import { isValidVideoUrl } from '../utils/validators'
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
  const [gameId, setGameId] = useState('')
  const [sourceInfo, setSourceInfo] = useState(null)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setLoadError('')
      setSourceInfo(null)
      setSelectedDemon(null)
      setManualMode(false)
      setManualLevelName('')
      setExternalUrl('')
      setGameId('')
      try {
        if (levelType === 'community') {
          const data = await getCollection('levels', [where('type', '==', 'community')])
          if (mounted) setCommunityLevels(data.filter(l => l.isActive !== false).sort((a, b) => a.position - b.position))
        } else {
          try {
            const data = await fetchAredlLevels()
            if (mounted) {
              setDemons(data)
              setSourceInfo({ name: 'aredl', count: data.length })
            }
          } catch (err) {
            console.warn('AREDL fetch failed, falling back to pointercrate:', err)
            const data = await fetchListedDemons(100)
            if (mounted) {
              setDemons(data.map(d => ({ ...d, dataSource: 'pointercrate' })))
              setSourceInfo({ name: 'pointercrate', count: data.length })
            }
          }
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

  if (authLoading) {
    return (
      <PageShell title="Submit Record">
        <div className={styles.loadingCenter}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  if (!user) return null

  const isValidExternalUrl = (url) => {
    if (!url) return true
    return /^https?:\/\/(www\.)?demonlist\.org\//.test(url)
  }

  const findDuplicate = async () => {
    const pending = await getCollection('submissions', [
      where('userId', '==', user.uid),
      where('status', '==', 'pending'),
    ])
    let dup = null
    if (manualMode) {
      dup = pending.find(s =>
        (s.requestType || 'completion') === 'completion' &&
        s.manualLevelName &&
        s.manualLevelName.toLowerCase() === manualLevelName.trim().toLowerCase()
      )
    } else if (levelType === 'main' && selectedDemon) {
      dup = pending.find(s => s.demonApiId === String(selectedDemon.id))
    } else if (levelType === 'community' && selectedDemon) {
      dup = pending.find(s => s.levelId === selectedDemon)
    }
    if (dup) return { duplicate: true }

    const targetLevelId = levelType === 'main' && selectedDemon
      ? `main_${selectedDemon.id}`
      : levelType === 'community' && selectedDemon
        ? selectedDemon
        : manualMode
          ? `manual_${manualLevelName.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
          : null
    if (targetLevelId) {
      const level = await getDocument('levels', targetLevelId)
      if (level && (level.victors || []).some(v => v.userId === user.uid)) {
        return { completed: true, levelName: level.name }
      }
      const completions = await getCollection('completions', [where('userId', '==', user.uid)])
      const already = completions.find(c => c.levelId === targetLevelId)
      if (already) return { completed: true, levelName: already.levelName }
    }
    if (levelType === 'main') {
      const searchName = manualMode ? manualLevelName.trim() : (selectedDemon ? String(selectedDemon.name || '') : '')
      if (searchName) {
        const byName = await findMainLevelByName(searchName)
        if (byName) {
          if ((byName.victors || []).some(v => v.userId === user.uid)) {
            return { completed: true, levelName: byName.name }
          }
          const completions = await getCollection('completions', [where('userId', '==', user.uid)])
          const already = completions.find(c => c.levelId === byName.id)
          if (already) return { completed: true, levelName: already.levelName || byName.name }
        }
      }
    }
    return null
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
    if (!isValidVideoUrl(videoUrl)) {
      setError('Please provide a valid video URL (YouTube, Medal, TikTok or Google Drive)')
      return
    }
    if (externalUrl && !isValidExternalUrl(externalUrl)) {
      setError('Link must be from demonlist.org')
      return
    }

    try {
      const dup = await findDuplicate()
      if (dup) {
        setError(dup.completed
          ? `You already have a verified completion for "${dup.levelName}".`
          : 'You already have a pending submission for this level.')
        return
      }
    } catch (err) {
      console.warn('Duplicate check failed, continuing:', err)
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
        data.demonGameId = selectedDemon.gameId || selectedDemon.level_id || ''
        data.dataSource = selectedDemon.dataSource || 'pointercrate'
      } else if (levelType === 'community' && selectedDemon) {
        data.levelId = selectedDemon
        if (gameId.trim()) data.gameId = gameId.trim()
      }

      await createDocument('submissions', null, data)
      setSuccess(true)
      setSelectedDemon(null)
      setVideoUrl('')
      setManualLevelName('')
      setExternalUrl('')
      setManualMode(false)
      setGameId('')
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
  const selectionError = error === 'Please select a level' ? error : ''
  const levelNameError = error === 'Please enter the level name' ? error : ''
  const videoError = error.startsWith('Please provide a valid video URL') ? error : ''
  const externalLinkError = error === 'Link must be from demonlist.org' ? error : ''
  const hasFieldError = !!(selectionError || levelNameError || videoError || externalLinkError)

  return (
    <PageShell title="Submit Record" subtitle="Submit a demon completion for verification">
      <div className={styles.container}>
        <Card padding="lg">
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.typeToggle} role="group" aria-label="Choose list type">
              <button
                type="button"
                className={`${styles.typeBtn} ${levelType === 'main' ? styles.active : ''}`}
                onClick={() => { setLevelType('main'); setError('') }}
                aria-pressed={levelType === 'main'}
              >
                Main List
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${levelType === 'community' ? styles.active : ''}`}
                onClick={() => { setLevelType('community'); setError('') }}
                aria-pressed={levelType === 'community'}
              >
                Community List
              </button>
            </div>

            {loadError && (
              <p className={styles.error} role="alert">{loadError}</p>
            )}

            {!manualMode ? (
              <>
                <SearchSelect
                  label="Level"
                  placeholder="Search for a level..."
                  options={levelOptions}
                  value={levelType === 'main' ? (selectedDemon ? String(selectedDemon.id) : '') : (selectedDemon || '')}
                  onChange={e => {
                    setError('')
                    if (levelType === 'main') {
                      const demon = demons.find(d => String(d.id) === e.target.value)
                      setSelectedDemon(demon || null)
                    } else {
                      setSelectedDemon(e.target.value || null)
                    }
                  }}
                  error={!selectedDemon ? selectionError : ''}
                  loading={loading}
                />
                {levelType === 'main' && sourceInfo && !loading && (
                  <p className={styles.sourceInfo}>
                    {sourceInfo.name === 'aredl'
                      ? `${sourceInfo.count} levels loaded from AREDL`
                      : `AREDL unavailable — showing top ${sourceInfo.count} from Pointercrate`}
                  </p>
                )}
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
                    onClick={() => { setManualMode(true); setError('') }}
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
                    onClick={() => { setManualMode(false); setError('') }}
                  >
                    Back to search
                  </button>
                </div>
                <Input
                  label="Level Name"
                  placeholder="e.g. Bloodbath"
                  value={manualLevelName}
                  onChange={e => setManualLevelName(e.target.value)}
                  error={!manualLevelName.trim() ? levelNameError : ''}
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

            {levelType === 'community' && (
              <Input
                label="Level ID (in-game)"
                type="text"
                placeholder="e.g. 10565740"
                value={gameId}
                onChange={e => setGameId(e.target.value)}
              />
            )}

            <Input
              label="Video URL"
              type="url"
              placeholder="https://youtu.be/..., https://medal.tv/..., https://tiktok.com/..., https://drive.google.com/..."
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              icon={Youtube}
              error={!isValidVideoUrl(videoUrl) ? videoError : ''}
            />

            {error && !hasFieldError && (
              <p className={styles.error} role="alert">{error}</p>
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
