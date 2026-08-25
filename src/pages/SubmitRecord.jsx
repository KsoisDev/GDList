import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Youtube, Send, ExternalLink, FileCheck2, ShieldCheck, Video } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import ThemedPageHero from '../components/layout/ThemedPageHero'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import SearchSelect from '../components/ui/SearchSelect'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { getCollection, where, getDocument, createDocument } from '../services/firestore'
import { fetchListedDemons } from '../services/gdl'
import { fetchAredlLevels } from '../services/aredl'
import { findMainLevelByName } from '../services/mainLevels'
import { isValidVideoUrl } from '../utils/validators'
import styles from './SubmitRecord.module.css'
import theme from '../components/layout/ThemedPage.module.css'

export default function SubmitRecord() {
  const { user, loading: authLoading } = useAuth()
  const { t } = useLanguage()
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
        setLoadError(t('submit.loadFailed'))
        console.error('Failed to load levels:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
  }, [levelType, t])

  if (authLoading) {
    return (
      <PageShell className={theme.pageShell}>
        <div className={theme.glow} aria-hidden="true" />
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
      setError(t('submit.selectLevel'))
      return
    }
    if (!manualMode && levelType === 'community' && !selectedDemon) {
      setError(t('submit.selectLevel'))
      return
    }
    if (manualMode && !manualLevelName.trim()) {
      setError(t('submit.enterLevel'))
      return
    }
    if (!isValidVideoUrl(videoUrl)) {
      setError(t('submit.validVideo'))
      return
    }
    if (externalUrl && !isValidExternalUrl(externalUrl)) {
      setError(t('submit.validExternal'))
      return
    }

    try {
      const dup = await findDuplicate()
      if (dup) {
        setError(dup.completed
          ? t('submit.completedDuplicate', { level: dup.levelName })
          : t('submit.pendingDuplicate'))
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
      <PageShell className={theme.pageShell}>
        <div className={theme.glow} aria-hidden="true" />
        <Card padding="lg" className={`${styles.successCard} ${theme.successSurface}`}>
          <h2 className={styles.successTitle}>{t('submit.sent')}</h2>
          <p className={styles.successText}>
            {t('submit.sentText')}
          </p>
          <div className={styles.successActions}>
            <Button variant="primary" onClick={() => setSuccess(false)}>
              {t('submit.another')}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/profile')}>
              {t('nav.myProfile')}
            </Button>
          </div>
        </Card>
      </PageShell>
    )
  }

  const levelOptions = getLevelOptions()
  const selectionError = error === t('submit.selectLevel') ? error : ''
  const levelNameError = error === t('submit.enterLevel') ? error : ''
  const videoError = error === t('submit.validVideo') ? error : ''
  const externalLinkError = error === t('submit.validExternal') ? error : ''
  const hasFieldError = !!(selectionError || levelNameError || videoError || externalLinkError)

  return (
    <PageShell className={theme.pageShell}>
      <div className={theme.glow} aria-hidden="true" />
      <ThemedPageHero
        eyebrow={t('submit.prove')}
        title={t('submit.submitA')}
        accentTitle={t('submit.record')}
        description={t('submit.recordDescription')}
        stats={[
          { icon: Video, value: t('submit.videoProof'), label: t('submit.videoProofHint') },
          { icon: ShieldCheck, value: t('submit.adminReview'), label: t('submit.adminReviewHint') },
          { icon: FileCheck2, value: t('submit.rankedResult'), label: t('submit.rankedResultHint'), featured: true },
        ]}
      />

      <section className={`${theme.surface} ${theme.formSurface}`} aria-label={t('submit.formLabel')}>
        <div className={theme.surfaceHeading}>
          <div>
            <span className={theme.sectionLabel}>{t('submit.newCompletion')}</span>
            <h2>{t('submit.recordDetails')}</h2>
          </div>
        </div>
        <div className={`${styles.container} ${theme.formContainer}`}>
        <Card padding="lg" className={theme.innerCard}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.typeToggle} role="group" aria-label={t('submit.chooseList')}>
              <button
                type="button"
                className={`${styles.typeBtn} ${levelType === 'main' ? styles.active : ''}`}
                onClick={() => { setLevelType('main'); setError('') }}
                aria-pressed={levelType === 'main'}
              >
                {t('nav.mainList')}
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${levelType === 'community' ? styles.active : ''}`}
                onClick={() => { setLevelType('community'); setError('') }}
                aria-pressed={levelType === 'community'}
              >
                {t('nav.communityList')}
              </button>
            </div>

            {loadError && (
              <p className={styles.error} role="alert">{loadError}</p>
            )}

            {!manualMode ? (
              <>
                <SearchSelect
                  label={t('common.level')}
                  placeholder={t('submit.searchLevel')}
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
                      <strong>{t('submit.levelNotListed')}</strong> {t('submit.submitTheLevel')}
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
                      <strong>{t('submit.levelNotListed')}</strong> {t('submit.enterManually')}
                    </span>
                    <span className={styles.manualArrow}>→</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <div className={styles.manualHeader}>
                  <span className={styles.manualLabel}>{t('submit.manualEntry')}</span>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => { setManualMode(false); setError('') }}
                  >
                    {t('submit.backSearch')}
                  </button>
                </div>
                <Input
                  label={t('submit.levelName')}
                  placeholder="e.g. Bloodbath"
                  value={manualLevelName}
                  onChange={e => setManualLevelName(e.target.value)}
                  error={!manualLevelName.trim() ? levelNameError : ''}
                />
                <Input
                  label={t('submit.linkOptional')}
                  type="url"
                  placeholder="https://demonlist.org/list/..."
                  value={externalUrl}
                  onChange={e => setExternalUrl(e.target.value)}
                  icon={ExternalLink}
                  error={externalUrl && !isValidExternalUrl(externalUrl) ? t('submit.validExternal') : ''}
                />
              </>
            )}

            {levelType === 'community' && (
              <Input
                label={t('submit.levelId')}
                type="text"
                placeholder="e.g. 10565740"
                value={gameId}
                onChange={e => setGameId(e.target.value)}
              />
            )}

            <Input
              label={t('submit.videoUrl')}
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
              {t('nav.submitRecord')}
            </Button>
          </form>
        </Card>
        </div>
      </section>
    </PageShell>
  )
}
