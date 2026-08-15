import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Edit3, Save, X, Send, Shield, Youtube, Trash2, AlertTriangle, Crown } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { updateDocument, getCollection, where } from '../services/firestore'
import { communityPoints } from '../utils/communityPoints'
import { computeBadges } from '../utils/badges'
import { deleteAccount } from '../services/deleteAccount'
import { logout } from '../services/auth'
import Modal from '../components/ui/Modal'
import { formatNumber, formatDate } from '../utils/format'
import { hasAccess } from '../utils/constants'
import styles from './Profile.module.css'

export default function MyProfile() {
  const { user, userData, loading: authLoading, refreshUserData } = useAuth()
  const navigate = useNavigate()
  const [completions, setCompletions] = useState([])
  const [badges, setBadges] = useState({ firstVictor: false, verifier: false })
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [avatarURL, setAvatarURL] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.displayName || '')
      setAvatarURL(userData.avatarURL || '')
      setBio(userData.bio || '')
    }
  }, [userData])

  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        const [comps, communityLevels] = await Promise.all([
          getCollection('completions'),
          getCollection('levels', [where('type', '==', 'community')]),
        ])
        const posMap = {}
        communityLevels.forEach(l => { posMap[l.id] = l.position })
        const userComps = comps
          .filter(c => c.userId === user.uid)
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
    load()
  }, [user])

  const handleSave = async () => {
    if (!user || !displayName.trim()) return
    setSaving(true)
    try {
      await updateDocument('users', user.uid, {
        displayName: displayName.trim(),
        avatarURL: avatarURL.trim() || '',
        bio: bio.trim() || '',
      })
      await refreshUserData()
      setEditing(false)
    } catch (err) {
      console.error('Failed to update profile:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setDisplayName(userData?.displayName || '')
    setAvatarURL(userData?.avatarURL || '')
    setBio(userData?.bio || '')
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteAccount(user.uid)
      await logout()
      navigate('/')
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading) {
    return (
      <PageShell>
        <div className={styles.loading}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  if (!userData) return null

  const stats = userData.stats || {}
  const mainComps = completions.filter(c => c.levelType === 'main')
  const communityComps = completions.filter(c => c.levelType === 'community')
  const communityPointsLive = communityComps.reduce((sum, c) => sum + (c.points || 0), 0)
  const mainPoints = stats.mainPoints || 0
  const totalPointsLive = parseFloat((mainPoints + communityPointsLive).toFixed(2))

  return (
    <PageShell>
      <div className={styles.profile}>
        <Card padding="lg" className={styles.header}>
          <div className={styles.headerContent}>
            {!editing && <Avatar src={userData.avatarURL} alt={userData.username} size="xl" />}
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
                  />
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Bio</label>
                    <textarea
                      className={styles.textarea}
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      rows={3}
                    />
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
                  <h1 className={styles.username}>{userData.displayName || userData.username}</h1>
                  <div className={styles.meta}>
                    <Badge variant={userData.role === 'owner' ? 'gold' : userData.role === 'admin' ? 'purple' : 'default'} size="sm">
                      {userData.role === 'owner' ? <Shield size={12} /> : userData.role === 'admin' ? <Shield size={12} /> : null}
                      {userData.role === 'owner' ? 'Owner' : userData.role === 'admin' ? 'Admin' : 'Player'}
                    </Badge>
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

        <div className={styles.actions}>
          <Link to="/submit">
            <Button variant="primary" icon={Send}>Submit Record</Button>
          </Link>
          {hasAccess(userData.role, 'admin') && (
            <Link to="/admin">
              <Button variant="secondary" icon={Shield}>Admin Panel</Button>
            </Link>
          )}
        </div>

        <div className={styles.dangerZone}>
          <Button variant="danger" icon={Trash2} onClick={() => setShowDeleteModal(true)} fullWidth>
            Delete Account
          </Button>
        </div>

        <Modal isOpen={showDeleteModal} onClose={() => !deleting && setShowDeleteModal(false)} title="Delete Account">
          <div className={styles.deleteModalContent}>
            <AlertTriangle size={48} className={styles.deleteWarningIcon} />
            <p className={styles.deleteWarning}>
              This will permanently delete your account and all associated data:
            </p>
            <ul className={styles.deleteList}>
              <li>Your profile and stats</li>
              <li>All submissions and completions</li>
              <li>Your entries in level victor lists</li>
              <li>Your Firebase Auth account</li>
            </ul>
            <p className={styles.deleteNote}>This action cannot be undone.</p>
            {deleteError && <p className={styles.deleteError}>{deleteError}</p>}
            <p className={styles.deletePrompt}>Type <strong>deleteaccount</strong> to confirm:</p>
            <Input
              placeholder="deleteaccount"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
            />
            <div className={styles.deleteActions}>
              <Button variant="ghost" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteAccount} loading={deleting} disabled={deleteConfirmText.trim().toLowerCase() !== 'deleteaccount'}>
                Delete My Account
              </Button>
            </div>
          </div>
        </Modal>

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
                        transition={{ delay: i * 0.03 }}
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
                            <a href={comp.videoURL} target="_blank" rel="noopener noreferrer" className={styles.compVideo}>
                              <Youtube size={16} />
                            </a>
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
                        transition={{ delay: i * 0.03 }}
                      >
                        <div className={styles.compInfo}>
                          <span className={styles.compLevel}>{comp.levelName || 'Unknown Level'}</span>
                          <span className={styles.compDate}>{formatDate(comp.completedAt)}</span>
                        </div>
                        <div className={styles.compRight}>
                          <span className={styles.compPoints}>+{comp.points} pts</span>
                          {comp.videoURL && (
                            <a href={comp.videoURL} target="_blank" rel="noopener noreferrer" className={styles.compVideo}>
                              <Youtube size={16} />
                            </a>
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
