import { useState } from 'react'
import { ArrowLeft, Lock, RefreshCw, CheckCircle2, AlertCircle, Link2 } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'
import { fetchAredlProfile, computeSyncPlan } from '../../services/syncAredl'
import { fetchGdlPlayer } from '../../services/syncGdl'
import { loadMainLevels } from '../../services/readCache'
import { createDocument, updateDocument } from '../../services/firestore'
import { startDiscordLogin, getStoredDiscordUser, clearDiscordUser } from '../../services/discordAuth'
import styles from './SyncListModal.module.css'

const LISTS = [
  {
    id: 'aredl',
    name: 'AREDL',
    logo: 'https://aredl.net/assets/logo.webp',
    active: true,
    type: 'sync',
  },
  {
    id: 'gdl',
    name: 'Global DL',
    logo: 'https://discord.do/wp-content/uploads/2023/09/Global-Demonlist.jpg',
    active: true,
    type: 'badge',
  },
  {
    id: 'pointercrate',
    name: 'Pointer',
    logo: 'https://www.pointercrate.com/static/images/logo.png',
    active: true,
    type: 'badge',
  },
]

export default function SyncListModal({ isOpen, onClose, userId, existingCompletions, onComplete }) {
  const [selectedList, setSelectedList] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [syncPlan, setSyncPlan] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [step, setStep] = useState('list')
  const [discordUser, setDiscordUser] = useState(() => getStoredDiscordUser())
  const [manualUrl, setManualUrl] = useState('')

  const reset = () => {
    setSelectedList(null)
    setSearchError('')
    setSelectedUser(null)
    setProfile(null)
    setSyncPlan(null)
    setSyncResult(null)
    setManualUrl('')
    setStep('list')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSelectList = (list) => {
    if (!list.active) return
    setSelectedList(list)
    if (list.id === 'aredl') {
      setStep('auth')
    } else if (list.id === 'gdl') {
      setStep('gdlLink')
    } else if (list.id === 'pointercrate') {
      setStep('ptLink')
    }
  }

  const handleDiscordLogin = () => {
    try {
      startDiscordLogin()
    } catch (err) {
      setSearchError(err.message || 'Discord login failed.')
    }
  }

  const handleLogoutDiscord = () => {
    clearDiscordUser()
    setDiscordUser(null)
  }

  const aredlAvatar = (user) => {
    if (!user?.avatar || !user?.id) return null
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`
  }

  const loadAredlProfile = async (id, user) => {
    setStep('profile')
    setLoadingProfile(true)
    setSelectedUser(user || null)
    try {
      const profileData = await fetchAredlProfile(id)
      setProfile(profileData)
      const mainLevels = await loadMainLevels()
      const plan = computeSyncPlan(profileData, mainLevels)
      setSyncPlan(plan)
    } catch (err) {
      setSearchError('Failed to load AREDL profile.')
      setStep('auth')
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleSelectAredlUser = async (user) => {
    await loadAredlProfile(user.id, user)
  }

  const handleSync = async () => {
    if (!syncPlan || !syncPlan.matched.length) return
    setSyncing(true)
    try {
      let added = 0
      let victorErrors = 0
      const existingLevelIds = new Set(existingCompletions.map(c => c.levelId))
      // Load the user's public profile so the victor snapshot has real data.
      const userDoc = await getDocument('users', userId)

      for (const { aredlRecord, gdLevel } of syncPlan.matched) {
        if (existingLevelIds.has(gdLevel.id)) continue
        const completionId = `aredl_sync_${userId}_${gdLevel.id}`
        await createDocument('completions', completionId, {
          userId,
          levelId: gdLevel.id,
          levelType: 'main',
          levelName: gdLevel.name,
          points: gdLevel.points || 0,
          videoURL: aredlRecord.video_url || '',
          completedAt: new Date(),
          source: 'aredl_sync',
        })
        added++

        try {
          const levelDoc = await getDocument('levels', gdLevel.id)
          const existingVictors = levelDoc?.victors || []
          if (!existingVictors.some(v => v.userId === userId)) {
            const now = new Date()
            await updateDocument('levels', gdLevel.id, {
              victoryCount: (levelDoc?.victoryCount || 0) + 1,
              victors: [...existingVictors, {
                userId,
                username: userDoc?.username || userDoc?.displayName || userId.slice(0, 6),
                displayName: userDoc?.displayName || userDoc?.username || 'Player',
                country: userDoc?.country || '',
                avatarURL: userDoc?.avatarURL || '',
                completionId,
                completedAt: now,
                videoURL: aredlRecord.video_url || '',
              }],
            })
          }
        } catch (victorErr) {
          victorErrors++
          console.error('[aredl-sync] victor update failed:', victorErr)
        }
      }

      await updateDocument('users', userId, {
        aredlSync: {
          discordId: profile.id || '',
          username: profile.username || '',
          globalName: profile.global_name || profile.username || '',
          avatar: profile.avatar || '',
          syncedAt: new Date(),
        },
      })

      setSyncResult({
        added,
        skipped: syncPlan.matched.length - added,
        victorErrors,
        unmatched: syncPlan.unmatched.length,
      })
      setStep('done')
      if (onComplete) onComplete()
    } catch (err) {
      setSearchError('Sync failed. Try again.')
    } finally {
      setSyncing(false)
    }
  }

  const handleGdlManualLink = async () => {
    const url = manualUrl.trim()
    if (!url) return
    const idMatch = url.match(/demonlist\.org\/profile\/(\d+)/)
    if (!idMatch) {
      setSearchError('Invalid URL. Paste your demonlist.org profile URL (e.g. demonlist.org/profile/12345).')
      return
    }
    const playerId = parseInt(idMatch[1])
    setSyncing(true)
    setSearchError('')
    try {
      let playerName = ''
      let score = 0
      let rank = null
      try {
        const fullProfile = await fetchGdlPlayer(playerId)
        playerName = fullProfile.name || ''
        score = fullProfile.score || 0
        rank = fullProfile.rank || null
      } catch {}

      await updateDocument('users', userId, {
        gdlSync: {
          playerId,
          playerName,
          score,
          rank,
          syncedAt: new Date(),
        },
      })
      setSyncResult({ linked: true })
      setStep('done')
      if (onComplete) onComplete()
    } catch (err) {
      setSearchError('Failed to link profile. Try again.')
    } finally {
      setSyncing(false)
    }
  }

  const handlePtManualLink = async () => {
    const url = manualUrl.trim()
    if (!url) return
    const idMatch = url.match(/player=(\d+)/)
    if (!idMatch) {
      setSearchError('Invalid URL. Paste your Pointercrate stats viewer URL (e.g. https://www.pointercrate.com/demonlist/statsviewer/?player=12345).')
      return
    }
    const playerId = parseInt(idMatch[1])
    setSyncing(true)
    setSearchError('')
    try {
      await updateDocument('users', userId, {
        pointercrateSync: {
          playerId,
          syncedAt: new Date(),
        },
      })
      setSyncResult({ linked: true })
      setStep('done')
      if (onComplete) onComplete()
    } catch (err) {
      setSearchError('Failed to link profile. Try again.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Sync with Another List">
      {step === 'list' && (
        <>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Import your completions from other demon lists or link your profile.
          </p>
          <div className={styles.listGrid}>
            {LISTS.map(list => (
              <div
                key={list.id}
                className={`${styles.listCard} ${!list.active ? styles.disabled : ''}`}
                onClick={() => handleSelectList(list)}
                role="button"
                tabIndex={list.active ? 0 : -1}
                aria-disabled={!list.active}
              >
                {list.logo ? (
                  <img src={list.logo} alt={list.name} className={styles.listLogo} />
                ) : (
                  <div className={styles.listLogo} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.06)', borderRadius: 12,
                  }}>
                    <Lock size={20} color="var(--text-muted)" />
                  </div>
                )}
                <span className={styles.listName}>{list.name}</span>
                {!list.active && <span className={styles.comingSoon}>Coming soon</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {step === 'auth' && selectedList?.id === 'aredl' && (
        <>
          <div className={styles.headerRow}>
            <button type="button" className={styles.backLink} onClick={() => { reset(); setStep('list') }}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>

          <div className={styles.authSection}>
            <button
              type="button"
              className={styles.discordBtn}
              onClick={handleDiscordLogin}
            >
              <svg width="20" height="15" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5604 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.9048 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2534 30.1099 30.1693C30.1099 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2534 53.7018 30.1693C53.7018 34.1136 50.872 37.3253 47.3178 37.3253Z" fill="white"/>
              </svg>
              Sign in with Discord
            </button>

            {searchError && (
              <p className={styles.authError}>{searchError}</p>
            )}
          </div>
        </>
      )}

      {step === 'gdlLink' && selectedList?.id === 'gdl' && (
        <>
          <div className={styles.headerRow}>
            <button type="button" className={styles.backLink} onClick={() => { reset(); setStep('list') }}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Paste your Global Demon List profile URL to link it as a badge.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 12 }}>
            No records are imported — this only shows a link on your profile.
          </p>
          <div className={styles.searchInput}>
            <input
              type="text"
              value={manualUrl}
              onChange={e => setManualUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGdlManualLink() }}
              placeholder="https://demonlist.org/profile/12345"
              style={{ color: 'var(--text-muted)' }}
            />
            <Button variant="primary" size="sm" icon={Link2} onClick={handleGdlManualLink} loading={syncing}>
              Link
            </Button>
          </div>
          {searchError && <p className={styles.authError}>{searchError}</p>}
        </>
      )}

      {step === 'ptLink' && selectedList?.id === 'pointercrate' && (
        <>
          <div className={styles.headerRow}>
            <button type="button" className={styles.backLink} onClick={() => { reset(); setStep('list') }}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Paste your Pointercrate stats viewer URL to link it as a badge.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 12 }}>
            No records are imported — this only shows a link on your profile.
          </p>
          <div className={styles.searchInput}>
            <input
              type="text"
              value={manualUrl}
              onChange={e => setManualUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePtManualLink() }}
              placeholder="https://www.pointercrate.com/demonlist/statsviewer/?player=12345"
              style={{ color: 'var(--text-muted)' }}
            />
            <Button variant="primary" size="sm" icon={Link2} onClick={handlePtManualLink} loading={syncing}>
              Link
            </Button>
          </div>
          {searchError && <p className={styles.authError}>{searchError}</p>}
        </>
      )}

      {step === 'profile' && selectedList?.id === 'aredl' && (
        <>
          <div className={styles.headerRow}>
            <button type="button" className={styles.backLink} onClick={() => { setProfile(null); setSyncPlan(null); setSelectedUser(null); setStep('auth') }}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
          {loadingProfile ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spinner />
            </div>
          ) : profile ? (
            <>
              <div className={styles.profilePreview}>
                <div className={styles.profileHeader}>
                  {selectedUser && aredlAvatar(selectedUser) && (
                    <img src={aredlAvatar(selectedUser)} alt="" className={styles.profileAvatar} />
                  )}
                  <div className={styles.profileInfo}>
                    <div className={styles.profileName}>{profile.global_name || profile.username}</div>
                    <div className={styles.profileStats}>
                      {(profile.records || []).length} records &middot; Rank #{profile.rank?.rank || '?'}
                    </div>
                  </div>
                </div>
                <div className={styles.recordsPreview}>
                  {(profile.records || []).slice(0, 20).map(rec => (
                    <div key={rec.id} className={styles.recordRow}>
                      <span className={styles.recordName}>{rec.level?.name || 'Unknown'}</span>
                      <span className={styles.recordPosition}>#{rec.level?.position || '?'}</span>
                    </div>
                  ))}
                  {(profile.records || []).length > 20 && (
                    <div className={styles.recordRow}>
                      <span className={styles.recordName} style={{ color: 'var(--text-muted)' }}>
                        +{(profile.records || []).length - 20} more
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {syncPlan && (
                <div className={styles.syncSummary}>
                  <span className={styles.matchedCount}>{syncPlan.matched.length} matched</span> with your GDList levels
                  {syncPlan.unmatched.length > 0 && (
                    <> &middot; <span className={styles.unmatchedCount}>{syncPlan.unmatched.length} unmatched</span></>
                  )}
                </div>
              )}
              {syncResult ? (
                <div className={styles.syncSummary} style={{ color: '#4ade80' }}>
                  <CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> Sync complete! {syncResult.added} added, {syncResult.skipped} already existed.
                </div>
              ) : (
                <div className={styles.syncActions}>
                  <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={RefreshCw}
                    onClick={handleSync}
                    loading={syncing}
                    disabled={!syncPlan || syncPlan.matched.length === 0}
                  >
                    Sync Records
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyResults}>
              <AlertCircle size={20} style={{ marginBottom: 8 }} />
              <p>Failed to load profile.</p>
            </div>
          )}
        </>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <CheckCircle2 size={40} color="#4ade80" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {syncResult?.linked ? 'Profile Linked' : 'Sync Complete'}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            {syncResult?.linked
              ? 'Your Global Demon List profile is now linked.'
              : `${syncResult?.added} record${syncResult?.added === 1 ? '' : 's'} added, ${syncResult?.skipped} skipped.`}
            {syncResult?.unmatched > 0 && ` ${syncResult.unmatched} not on the main list.`}
            {syncResult?.victorErrors > 0 && ` ${syncResult.victorErrors} victor update${syncResult.victorErrors === 1 ? '' : 's'} deferred.`}
          </p>
          <Button variant="primary" size="sm" onClick={handleClose}>Done</Button>
        </div>
      )}
    </Modal>
  )
}
