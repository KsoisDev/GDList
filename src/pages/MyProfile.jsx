import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Edit3, Save, X, Send, Shield, Youtube, Trash2, AlertTriangle, Crown, KeyRound, MailCheck, Share2, RefreshCw } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import ProfileProgress from '../components/profile/ProfileProgress'
import RoleBadge from '../components/profile/RoleBadge'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { createDocument, updateDocument, getCollection, getDocument, where } from '../services/firestore'
import { loadCommunityLevels, invalidateCache } from '../services/readCache'
import { communityPoints } from '../utils/communityPoints'
import { computeBadges } from '../utils/badges'
import { getDisplayName, formatNumber, formatDate } from '../utils/format'
import { COUNTRIES, getFlagUrl } from '../utils/countries'
import { deleteAccount } from '../services/deleteAccount'
import { deleteCompletionRecord } from '../services/deleteCompletion'
import { syncVictorsSnapshot } from '../services/syncUsernames'
import {
  changePassword,
  getAuthErrorMessage,
  logout,
  reauthenticateCurrentUser,
  updateCurrentUserProfile,
  usesPasswordProvider,
} from '../services/auth'
import Modal from '../components/ui/Modal'
import SyncListModal from '../components/profile/SyncListModal'
import { completeDiscordLogin, hasPendingDiscordLogin, clearPendingDiscordLogin, getStoredDiscordUser } from '../services/discordAuth'
import { fetchAredlProfileByDiscordId, computeSyncPlan } from '../services/syncAredl'
import { getGdlProfileUrl } from '../services/syncGdl'
import { loadMainLevels } from '../services/readCache'
import { hasAccess } from '../utils/constants'
import styles from './Profile.module.css'
import theme from '../components/layout/ThemedPage.module.css'
import { useShareProfile } from '../hooks/useShareProfile'

export default function MyProfile() {
  const {
    user,
    userData,
    loading: authLoading,
    refreshUserData,
    profileError: accountLoadError,
    retryProfile,
  } = useAuth()
  const navigate = useNavigate()
  const [completions, setCompletions] = useState([])
  const [badges, setBadges] = useState({ firstVictor: false, verifier: false })
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [avatarURL, setAvatarURL] = useState('')
  const [bio, setBio] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [completionDeleting, setCompletionDeleting] = useState(false)
  const [completionDeleteError, setCompletionDeleteError] = useState('')
  const [syncingAredl, setSyncingAredl] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const { shareProfile, shareStatus } = useShareProfile(
    getDisplayName(userData),
    user ? `/profile/${user.uid}` : '/profile',
  )

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.displayName || '')
      setAvatarURL(userData.avatarURL || '')
      setBio(userData.bio || '')
      setCountry(userData.country || '')
    }
  }, [userData])

  useEffect(() => {
    const tokenHash = searchParams.get('discord_token')
    // Wait for both the auth session and the profile document to be ready,
    // otherwise userData can be null while we build the victor snapshot.
    if (!tokenHash || !user || !userData) return

    const finishDiscord = async () => {
      setSyncingAredl(true)
      try {
        const discordUser = await completeDiscordLogin(tokenHash)
        setSearchParams({}, { replace: true })

        const aredlProfile = await fetchAredlProfileByDiscordId(discordUser.id)
        if (!aredlProfile) {
          setProfileError('No AREDL account found linked to this Discord account.')
          return
        }

        const mainLevels = await loadMainLevels()
        const plan = computeSyncPlan(aredlProfile, mainLevels)

        const existingComps = await getCollection('completions', [where('userId', '==', user.uid)])
        const existingLevelIds = new Set(existingComps.map(c => c.levelId))
        let added = 0
        let victorErrors = 0
        for (const { aredlRecord, gdLevel } of plan.matched) {
          if (existingLevelIds.has(gdLevel.id)) continue
          const completionId = `aredl_sync_${user.uid}_${gdLevel.id}`
          await createDocument('completions', completionId, {
            userId: user.uid,
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
            if (!existingVictors.some(v => v.userId === user.uid)) {
              const now = new Date()
              await updateDocument('levels', gdLevel.id, {
                victoryCount: (levelDoc?.victoryCount || 0) + 1,
                victors: [...existingVictors, {
                  userId: user.uid,
                  username: userData.username || userData.displayName || user.uid.slice(0, 6),
                  displayName: userData.displayName || userData.username || 'Player',
                  country: userData.country || '',
                  avatarURL: userData.avatarURL || '',
                  completionId,
                  completedAt: now,
                  videoURL: aredlRecord.video_url || '',
                }],
              })
            }
          } catch (victorErr) {
            victorErrors++
            console.error('AREDL sync: could not update victors for', gdLevel.id, victorErr)
          }
        }

        await updateDocument('users', user.uid, {
          aredlSync: {
            discordId: discordUser.id,
            username: aredlProfile.username || '',
            globalName: aredlProfile.global_name || aredlProfile.username || '',
            avatar: discordUser.avatar || '',
            syncedAt: new Date(),
          },
        })

        const importedNote = added > 0
          ? `${added} record${added === 1 ? '' : 's'} imported`
          : 'No new records to import'
        const unmatchedNote = plan.unmatched.length > 0
          ? ` · ${plan.unmatched.length} not found on the main list`
          : ''
        const victorNote = victorErrors > 0
          ? ` · ${victorErrors} victor update${victorErrors === 1 ? '' : 's'} deferred`
          : ''
        setProfileError('')
        setProfileMessage(`AREDL sync complete! ${importedNote}${unmatchedNote}${victorNote}.`)
        await loadCompletions()
        await refreshUserData()
      } catch (err) {
        console.error('AREDL discord sync failed:', err)
        setProfileError(err.message || 'AREDL sync failed.')
      } finally {
        setSyncingAredl(false)
      }
    }
    finishDiscord()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user, userData])

  const handleUnsyncAredl = async () => {
    if (!user) return
    try {
      const comps = await getCollection('completions', [where('userId', '==', user.uid)])
      const synced = comps.filter(c => c.source === 'aredl_sync')

      for (const c of synced) {
        try {
          await deleteCompletionRecord(c.id)
        } catch {}
      }

      await updateDocument('users', user.uid, { aredlSync: null })
      clearPendingDiscordLogin()
      await refreshUserData()
      await loadCompletions()
      setProfileMessage(`AREDL sync removed. ${synced.length} imported records deleted.`)
    } catch (err) {
      setProfileError('Failed to unsync.')
    }
  }

  const handleUnlinkGdl = async () => {
    if (!user) return
    try {
      await updateDocument('users', user.uid, { gdlSync: null })
      await refreshUserData()
      setProfileMessage('Global Demon List profile unlinked.')
    } catch (err) {
      setProfileError('Failed to unlink.')
    }
  }


  const loadCompletions = async () => {
    if (!user) return
    try {
      const [comps, communityLevels] = await Promise.all([
        getCollection('completions', [where('userId', '==', user.uid)]),
        loadCommunityLevels(),
      ])
      const posMap = {}
      communityLevels.forEach(l => { posMap[l.id] = l.position })
      const userComps = comps
        .map(c => {
          if (c.levelType === 'community') {
            const pos = posMap[c.levelId]
            if (pos) return { ...c, points: communityPoints(pos) }
          }
          return c
        })
        .sort((a, b) => {
          const ta = a.completedAt?.toMillis?.() || 0
          const tb = b.completedAt?.toMillis?.() || 0
          return tb - ta
        })
      setCompletions(userComps)
      setBadges(computeBadges(communityLevels, user.uid))
    } catch (err) {
      console.error('Failed to load completions:', err)
    }
  }

  useEffect(() => {
    loadCompletions()
  }, [user])

  const handleSave = async () => {
    if (!user || !displayName.trim()) return
    setSaving(true)
    setProfileError('')
    setProfileMessage('')
    try {
      await updateCurrentUserProfile(displayName, avatarURL)
      await updateDocument('users', user.uid, {
        displayName: displayName.trim(),
        avatarURL: avatarURL.trim() || '',
        bio: bio.trim() || '',
        country: country,
      })
      try {
        await syncVictorsSnapshot(user.uid, { username: displayName.trim(), displayName: displayName.trim(), country, avatarURL: avatarURL.trim() || '' })
      } catch (syncErr) {
        console.warn('Victors name sync failed:', syncErr)
      }
      await refreshUserData()
      setEditing(false)
      setProfileMessage('Profile updated successfully.')
    } catch (err) {
      console.error('Failed to update profile:', err)
      setProfileError(getAuthErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setDisplayName(userData?.displayName || '')
    setAvatarURL(userData?.avatarURL || '')
    setBio(userData?.bio || '')
    setCountry(userData?.country || '')
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await reauthenticateCurrentUser(deletePassword)
      await deleteAccount(user.uid)
      await logout()
      navigate('/')
    } catch (err) {
      setDeleteError(getAuthErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    if (newPassword.length < 8) {
      setPasswordError('Use a new password with at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.')
      return
    }

    setChangingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password changed successfully.')
      setShowPasswordModal(false)
    } catch (err) {
      setPasswordError(getAuthErrorMessage(err))
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDeleteCompletion = async () => {
    if (!deleteTarget) return
    setCompletionDeleting(true)
    setCompletionDeleteError('')
    try {
      await deleteCompletionRecord(deleteTarget.id)
      setDeleteTarget(null)
      await loadCompletions()
    } catch (err) {
      console.error(err)
      setCompletionDeleteError(err.message)
    } finally {
      setCompletionDeleting(false)
    }
  }

  if (authLoading) {
    return (
      <PageShell className={theme.pageShell}>
        <div className={theme.glow} aria-hidden="true" />
        <div className={styles.loading}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  if (!userData) {
    return (
      <PageShell className={theme.pageShell}>
        <div className={theme.glow} aria-hidden="true" />
        <div className={styles.profileLoadError} role="alert">
          <h1>Profile unavailable</h1>
          <p>{accountLoadError?.message || 'Your profile could not be loaded. Please try again.'}</p>
          <Button variant="primary" onClick={retryProfile}>Try Again</Button>
        </div>
      </PageShell>
    )
  }

  const stats = userData.stats || {}
  const mainComps = completions.filter(c => c.levelType === 'main')
  const communityComps = completions.filter(c => c.levelType === 'community')
  const communityPointsLive = communityComps.reduce((sum, c) => sum + (c.points || 0), 0)
  const mainPointsFromCompletions = mainComps.reduce((sum, completion) => sum + (completion.points || 0), 0)
  const mainPoints = stats.mainPoints || mainPointsFromCompletions
  const totalPointsLive = parseFloat((mainPoints + communityPointsLive).toFixed(2))
  const passwordAccount = usesPasswordProvider(user)

  return (
    <PageShell className={theme.pageShell}>
      <div className={theme.glow} aria-hidden="true" />
      <div className={styles.profile}>
        <Card padding="lg" className={styles.header}>
          <span className={styles.profileEyebrow}>YOUR BASEMENT PROFILE</span>
          <div className={styles.headerContent}>
            {!editing && (
              <div className={styles.avatarFrame}>
                <Avatar src={userData.avatarURL} alt={getDisplayName(userData)} size="xl" />
              </div>
            )}
            <div className={styles.headerInfo}>
              {editing ? (
                <div className={styles.editForm}>
                  <Input
                    label="Avatar URL"
                    type="url"
                    value={avatarURL}
                    onChange={e => setAvatarURL(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                  />
                  <Input
                    label="Display Name"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Display name"
                    maxLength={32}
                  />
                  <Select
                    label="Country"
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    placeholder="Select your country..."
                    options={COUNTRIES.map(c => ({ value: c.code, label: c.name }))}
                  />
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="profile-bio">Bio</label>
                    <textarea
                      id="profile-bio"
                      className={styles.textarea}
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={3}
                      maxLength={200}
                    />
                    <span className={styles.fieldHint}>{bio.length}/200</span>
                  </div>
                  <div className={styles.editActions}>
                    <Button variant="primary" size="sm" onClick={handleSave} loading={saving} icon={Save}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCancel} icon={X}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className={styles.username}>
                    {getDisplayName(userData)}
                    {getFlagUrl(userData.country) && (
                      <img src={getFlagUrl(userData.country)} alt={userData.country} className={styles.flagImg} loading="lazy" />
                    )}
                  </h1>
                  <div className={styles.meta}>
                    <RoleBadge role={userData.role} username={userData.username} banned={userData.banned} isDeveloper={userData.isDeveloper} />
                    {badges.firstVictor && (
                      <Badge variant="gold" size="sm" title="First victor of a community level">
                        <Crown size={12} /> First Victor
                      </Badge>
                    )}
                    {badges.verifier && (
                      <Badge variant="blue" size="sm" title="Verified a community level">
                        <Shield size={12} /> Verifier
                      </Badge>
                    )}
                    <span className={styles.joinDate}>
                      Joined {formatDate(userData.createdAt)}
                    </span>
                    {userData.aredlSync && (
                      <a
                        href={`https://aredl.net/profile/user/${encodeURIComponent(userData.aredlSync.username)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.aredlBadge}
                        title="View AREDL Profile"
                      >
                        <img
                          src="https://aredl.net/assets/logo.webp"
                          alt="ARED"
                          className={styles.aredlLogo}
                        />
                        <span className={styles.aredlUser}>
                          {userData.aredlSync.globalName || userData.aredlSync.username}
                        </span>
                        <button
                          type="button"
                          className={styles.aredlUnsync}
                          onClick={(e) => { e.stopPropagation(); handleUnsyncAredl() }}
                          title="Unsync AREDL"
                        >
                          <X size={12} />
                        </button>
                      </a>
                    )}
                    {userData.gdlSync && (
                      <a
                        href={getGdlProfileUrl(userData.gdlSync.playerId, userData.gdlSync.playerName)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.gdlBadge}
                        title="View Global Demon List Profile"
                      >
                        <span className={styles.gdlIcon}>🌐</span>
                        <span className={styles.gdlUser}>
                          {userData.gdlSync.playerName}
                        </span>
                        <button
                          type="button"
                          className={styles.gdlUnsync}
                          onClick={(e) => { e.stopPropagation(); handleUnlinkGdl() }}
                          title="Unlink Global DL"
                        >
                          <X size={12} />
                        </button>
                      </a>
                    )}
                    <div className={styles.editBtn}>
                      <Button variant="ghost" size="sm" icon={Edit3} onClick={() => setEditing(true)}>
                        Edit Profile
                      </Button>
                    </div>
                  </div>
                  {userData.bio && <p className={styles.bio}>{userData.bio}</p>}
                </>
              )}
            </div>
          </div>
        </Card>

        {profileMessage && <p className={styles.successMessage} role="status">{profileMessage}</p>}
        {profileError && <p className={styles.formError} role="alert">{profileError}</p>}

        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <span className={styles.statValue}>{formatNumber(totalPointsLive)}</span>
            <span className={styles.statLabel}>Total Points</span>
          </Card>
          <Card className={styles.statCard}>
            <span className={styles.statValue}>{formatNumber(mainPoints)}</span>
            <span className={styles.statLabel}>Main Points</span>
          </Card>
          <Card className={styles.statCard}>
            <span className={styles.statValue}>{formatNumber(communityPointsLive)}</span>
            <span className={styles.statLabel}>Community Points</span>
          </Card>
          <Card className={styles.statCard}>
            <span className={styles.statValue}>{mainComps.length + communityComps.length}</span>
            <span className={styles.statLabel}>Completions</span>
          </Card>
        </div>

        <ProfileProgress
          totalPoints={totalPointsLive}
          mainCount={mainComps.length}
          communityCount={communityComps.length}
        />

        <div className={styles.actions}>
          <Button to="/submit" variant="primary" icon={Send}>Submit Record</Button>
          <Button variant="secondary" icon={Share2} onClick={shareProfile}>{shareStatus || 'Share Profile'}</Button>
          <Button variant="secondary" icon={RefreshCw} onClick={() => setShowSyncModal(true)}>Sync List</Button>
          {hasAccess(userData.role, 'admin') && (
            <Button to="/admin" variant="secondary" icon={Shield}>Admin Panel</Button>
          )}
        </div>

        <Card padding="lg" className={styles.accountSettings}>
          <div className={styles.accountHeading}>
            <div>
              <span className={styles.accountEyebrow}>Account security</span>
              <h2>Sign-in settings</h2>
            </div>
            <Shield size={20} aria-hidden="true" />
          </div>
          <div className={styles.accountRows}>
            <div className={styles.accountRow}>
              <div>
                <span className={styles.accountLabel}>Email</span>
                <strong>{user.email || 'No email available'}</strong>
              </div>
              <span className={`${styles.accountStatus} ${user.emailVerified ? styles.verified : styles.unverified}`}>
                <MailCheck size={14} /> {user.emailVerified ? 'Verified' : 'Not verified'}
              </span>
            </div>
            <div className={styles.accountRow}>
              <div>
                <span className={styles.accountLabel}>Sign-in method</span>
                <strong>{passwordAccount ? 'Email and password' : 'Google'}</strong>
              </div>
              <div className={styles.accountActions}>
                {!user.emailVerified && passwordAccount && (
                  <Button to="/verify-email" variant="secondary" size="sm">Verify Email</Button>
                )}
                {passwordAccount && (
                  <Button variant="secondary" size="sm" icon={KeyRound} onClick={() => { setPasswordError(''); setShowPasswordModal(true) }}>
                    Change Password
                  </Button>
                )}
              </div>
            </div>
          </div>
          {passwordMessage && <p className={styles.successMessage} role="status">{passwordMessage}</p>}
        </Card>

        <div className={styles.dangerZone}>
          <div>
            <span className={styles.accountEyebrow}>Danger zone</span>
            <p>Permanently remove your profile, records, and sign-in account.</p>
          </div>
          <Button variant="danger" icon={Trash2} onClick={() => setShowDeleteModal(true)}>
            Delete Account
          </Button>
        </div>

        <Modal isOpen={showPasswordModal} onClose={() => !changingPassword && setShowPasswordModal(false)} title="Change Password">
          <form className={styles.securityForm} onSubmit={handleChangePassword}>
            <p>Confirm your current password, then choose a new password with at least 8 characters.</p>
            <Input label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
            <Input label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
            {passwordError && <p className={styles.formError} role="alert">{passwordError}</p>}
            <div className={styles.deleteActions}>
              <Button variant="ghost" onClick={() => setShowPasswordModal(false)} disabled={changingPassword}>Cancel</Button>
              <Button type="submit" variant="primary" loading={changingPassword}>Update Password</Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={showDeleteModal} onClose={() => !deleting && setShowDeleteModal(false)} title="Delete Account">
          <div className={styles.deleteModalContent}>
            <AlertTriangle size={48} className={styles.deleteWarningIcon} />
            <p className={styles.deleteWarning}>
              This will permanently delete your account and all associated data:
            </p>
            <ul className={styles.deleteList}>
              <li>Your profile and stats</li>
              <li>Pending submissions and verified completions</li>
              <li>Your entries in level victor lists</li>
              <li>Your Firebase Auth account</li>
            </ul>
            <p className={styles.deleteNote}>Resolved moderation records are retained for list integrity, without access to your deleted profile.</p>
            <p className={styles.deleteNote}>This action cannot be undone.</p>
            {deleteError && <p className={styles.deleteError} role="alert">{deleteError}</p>}
            <p className={styles.deletePrompt}>Type <strong>deleteaccount</strong> to confirm:</p>
            <Input
              label="Confirmation text"
              placeholder="deleteaccount"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
            />
            {passwordAccount && (
              <Input
                label="Current password"
                type="password"
                autoComplete="current-password"
                placeholder="Required to confirm your identity"
                value={deletePassword}
                onChange={event => setDeletePassword(event.target.value)}
              />
            )}
            <div className={styles.deleteActions}>
              <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteAccount}
                loading={deleting}
                disabled={deleteConfirmText.trim().toLowerCase() !== 'deleteaccount' || (passwordAccount && !deletePassword)}
              >
                Delete My Account
              </Button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={!!deleteTarget} onClose={() => !completionDeleting && setDeleteTarget(null)} title="Delete Record">
          <div className={styles.reportModal}>
            <AlertTriangle size={32} className={styles.deleteWarningIcon} />
            <p className={styles.reportDesc}>
              Delete this record? This will remove the completion, subtract its points from the player, and remove
              them from the level's victor list. This cannot be undone.
            </p>
            {deleteTarget && (
              <p className={styles.deleteTarget}>
                <strong>{deleteTarget.levelName || 'Unknown Level'}</strong>
                {deleteTarget.levelType === 'community' ? ' (Community)' : ' (Main List)'}
                {' · +'} {deleteTarget.points} pts
              </p>
            )}
            {completionDeleteError && <p className={styles.deleteError} role="alert">{completionDeleteError}</p>}
            <div className={styles.reportActions}>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={completionDeleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteCompletion} loading={completionDeleting} icon={Trash2}>
                Delete Record
              </Button>
            </div>
          </div>
        </Modal>

        <SyncListModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          userId={user.uid}
          existingCompletions={completions}
          onComplete={async () => { await loadCompletions(); await refreshUserData() }}
        />

        {(() => {
          return (
            <>
              {mainComps.length > 0 && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Main List Completions ({mainComps.length})</h2>
                  <div className={styles.completions}>
                    {mainComps.map((comp, i) => (
                      <motion.div
                        key={comp.id}
                        className={styles.completion}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 12) * 0.03 }}
                      >
                        <div className={styles.compInfo}>
                          <span className={styles.compLevel}>
                            <Link to={`/levels/${comp.levelId}`} className={styles.compLink}>{comp.levelName || 'Unknown Level'}</Link>
                          </span>
                          <span className={styles.compDate}>{formatDate(comp.completedAt)}</span>
                        </div>
                        <div className={styles.compRight}>
                          <span className={styles.compPoints}>+{comp.points} pts</span>
                          {comp.videoURL && (
                            <a
                              href={comp.videoURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.compVideo}
                              aria-label={`Watch ${comp.levelName || 'level'} completion video`}
                            >
                              <Youtube size={16} aria-hidden="true" />
                            </a>
                          )}
                          {hasAccess(userData.role, 'admin') && (
                            <button
                              type="button"
                              className={styles.compDelete}
                              onClick={() => setDeleteTarget(comp)}
                              title="Delete this record"
                              aria-label={`Delete ${comp.levelName || 'record'}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {communityComps.length > 0 && (
                <div className={styles.section}>
                  <h2 className={styles.sectionTitle}>Community Completions ({communityComps.length})</h2>
                  <div className={styles.completions}>
                    {communityComps.map((comp, i) => (
                      <motion.div
                        key={comp.id}
                        className={styles.completion}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 12) * 0.03 }}
                      >
                        <div className={styles.compInfo}>
                          <span className={styles.compLevel}>
                            <Link to={`/levels/${comp.levelId}`} className={styles.compLink}>{comp.levelName || 'Unknown Level'}</Link>
                          </span>
                          <span className={styles.compDate}>{formatDate(comp.completedAt)}</span>
                        </div>
                        <div className={styles.compRight}>
                          <span className={styles.compPoints}>+{comp.points} pts</span>
                          {comp.videoURL && (
                            <a
                              href={comp.videoURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.compVideo}
                              aria-label={`Watch ${comp.levelName || 'level'} completion video`}
                            >
                              <Youtube size={16} aria-hidden="true" />
                            </a>
                          )}
                          {hasAccess(userData.role, 'admin') && (
                            <button
                              type="button"
                              className={styles.compDelete}
                              onClick={() => setDeleteTarget(comp)}
                              title="Delete this record"
                              aria-label={`Delete ${comp.levelName || 'record'}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {completions.length === 0 && (
                <div className={styles.section}>
                  <p className={styles.emptyText}>No completions yet. Submit your first record!</p>
                </div>
              )}
            </>
          )
        })()}
      </div>
    </PageShell>
  )
}
