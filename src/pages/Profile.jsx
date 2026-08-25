import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { Calendar, Trophy, Medal, List, Youtube, Flag, Crown, Shield, Trash2, AlertTriangle, Share2 } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import ProfileProgress from '../components/profile/ProfileProgress'
import RoleBadge from '../components/profile/RoleBadge'
import Avatar from '../components/ui/Avatar'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { getDocument, getCollection, createDocument, where } from '../services/firestore'
import { loadCommunityLevels } from '../services/readCache'
import { deleteCompletionRecord } from '../services/deleteCompletion'
import { communityPoints } from '../utils/communityPoints'
import { computeBadges } from '../utils/badges'
import { formatNumber, formatDate, getDisplayName } from '../utils/format'
import { getFlagUrl } from '../utils/countries'
import { hasAccess } from '../utils/constants'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import styles from './Profile.module.css'
import theme from '../components/layout/ThemedPage.module.css'
import { useShareProfile } from '../hooks/useShareProfile'

export default function Profile() {
  const { userId } = useParams()
  const { user, userData } = useAuth()
  const [profile, setProfile] = useState(null)
  const [completions, setCompletions] = useState([])
  const [badges, setBadges] = useState({ firstVictor: false, verifier: false })
  const [loading, setLoading] = useState(true)
  const [reportModal, setReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [sendingReport, setSendingReport] = useState(false)
  const [reportError, setReportError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const isAdmin = hasAccess(userData?.role || 'user', 'admin')
  const { shareProfile, shareStatus } = useShareProfile(getDisplayName(profile), `/profile/${userId}`)

  const load = async (uid = userId) => {
    setLoading(true)
    try {
      const [profileResult, completionsResult, communityLevelsResult, staffResult] = await Promise.allSettled([
        getDocument('users', uid),
        getCollection('completions', [where('userId', '==', uid)]),
        loadCommunityLevels(),
        getDocument('staff', uid),
      ])
      const communityLevels = communityLevelsResult.status === 'fulfilled' ? communityLevelsResult.value : []
      const comps = completionsResult.status === 'fulfilled' ? completionsResult.value : []
      const userComps = [...comps].sort((a, b) => {
        const ta = a.completedAt?.toMillis?.() || 0
        const tb = b.completedAt?.toMillis?.() || 0
        return tb - ta
      })
      const posMap = {}
      communityLevels.forEach(level => { posMap[level.id] = level.position })
      const withLivePoints = userComps.map(completion => {
        if (completion.levelType === 'community') {
          const position = posMap[completion.levelId]
          if (position) return { ...completion, points: communityPoints(position) }
        }
        return completion
      })

      let snapshotProfile = null
      const latestComp = withLivePoints[0]
      if (latestComp) {
        snapshotProfile = {
          id: uid,
          username: latestComp.username || latestComp.displayName || 'Basement player',
          displayName: latestComp.displayName || latestComp.username || 'Basement player',
          avatarURL: latestComp.avatarURL || '',
          country: latestComp.country || '',
          role: 'user',
          createdAt: latestComp.completedAt || null,
        }
      }

      const privateProfile = profileResult.status === 'fulfilled' ? profileResult.value : null
      const staffProfile = staffResult.status === 'fulfilled' ? staffResult.value : null
      const fallbackProfile = snapshotProfile || (withLivePoints.length > 0 ? {
        id: uid,
        username: 'Basement player',
        displayName: 'Basement player',
        role: 'user',
        createdAt: withLivePoints.at(-1)?.completedAt || null,
      } : staffProfile ? {
        id: uid,
        username: staffProfile.displayName || 'Basement developer',
        displayName: staffProfile.displayName || 'Basement developer',
        role: 'developer',
      } : null)
      const resolvedProfile = privateProfile || fallbackProfile
      setProfile(resolvedProfile ? {
        ...resolvedProfile,
        teamTitle: staffProfile?.title || '',
      } : null)
      setCompletions(withLivePoints)
      setBadges(computeBadges(communityLevels, uid))
    } catch (err) {
      console.error('Failed to load profile:', err)
      setProfile(null)
      setCompletions([])
      setBadges({ firstVictor: false, verifier: false })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId) load(userId)
  }, [userId])

  const mainComps = completions.filter(c => c.levelType === 'main')
  const communityComps = completions.filter(c => c.levelType === 'community')

  const handleDeleteCompletion = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteCompletionRecord(deleteTarget.id)
      setDeleteTarget(null)
      await load(userId)
    } catch (err) {
      console.error(err)
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <PageShell className={theme.pageShell}>
        <div className={theme.glow} aria-hidden="true" />
        <div className={styles.loading}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  if (!profile) {
    return (
      <PageShell title="User Not Found" className={theme.pageShell}>
        <div className={theme.glow} aria-hidden="true" />
        <p>This user does not exist.</p>
      </PageShell>
    )
  }

  const stats = profile.stats || {}
  const mainPointsFromCompletions = mainComps.reduce((sum, completion) => sum + (completion.points || 0), 0)
  const mainPoints = stats.mainPoints || mainPointsFromCompletions
  const communityPointsLive = communityComps.reduce((sum, c) => sum + (c.points || 0), 0)
  const totalPointsLive = parseFloat((mainPoints + communityPointsLive).toFixed(2))

  return (
    <PageShell className={theme.pageShell}>
      <div className={theme.glow} aria-hidden="true" />
      <div className={styles.profile}>
        <Card padding="lg" className={styles.header}>
          <span className={styles.profileEyebrow}>BASEMENT PLAYER PROFILE</span>
          <div className={styles.headerContent}>
            <div className={styles.avatarFrame}>
              <Avatar src={profile.avatarURL} alt={getDisplayName(profile)} size="xl" />
            </div>
            <div className={styles.headerInfo}>
              <h1 className={styles.username}>
                {getDisplayName(profile)}
                {getFlagUrl(profile.country) && (
                  <img src={getFlagUrl(profile.country)} alt={profile.country} className={styles.flagImg} loading="lazy" />
                )}
              </h1>
              <div className={styles.meta}>
                <RoleBadge role={profile.role} title={profile.teamTitle} username={profile.username} banned={profile.banned} isDeveloper={profile.isDeveloper} />
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
                  <Calendar size={14} /> Joined {formatDate(profile.createdAt)}
                </span>
              </div>
              {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
            </div>
          </div>
          <div className={styles.headerActions}>
            <Button variant="secondary" size="sm" icon={Share2} onClick={shareProfile}>
              {shareStatus || 'Share Profile'}
            </Button>
            {user && user.uid !== userId && (
              <Button variant="ghost" size="sm" icon={Flag} onClick={() => { setReportError(''); setReportModal(true) }}>
                Report User
              </Button>
            )}
          </div>
        </Card>

        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <Trophy size={20} className={styles.statIcon} style={{ color: 'var(--accent-gold)' }} />
            <span className={styles.statValue}>{formatNumber(totalPointsLive)}</span>
            <span className={styles.statLabel}>Total Points</span>
          </Card>
          <Card className={styles.statCard}>
            <Medal size={20} className={styles.statIcon} style={{ color: 'var(--accent-green)' }} />
            <span className={styles.statValue}>{formatNumber(mainPoints)}</span>
            <span className={styles.statLabel}>Main Points</span>
          </Card>
          <Card className={styles.statCard}>
            <Medal size={20} className={styles.statIcon} style={{ color: 'var(--accent-blue)' }} />
            <span className={styles.statValue}>{formatNumber(communityPointsLive)}</span>
            <span className={styles.statLabel}>Community Points</span>
          </Card>
          <Card className={styles.statCard}>
            <List size={20} className={styles.statIcon} style={{ color: 'var(--accent-purple)' }} />
            <span className={styles.statValue}>{mainComps.length + communityComps.length}</span>
            <span className={styles.statLabel}>Completions</span>
          </Card>
        </div>

        <ProfileProgress
          totalPoints={totalPointsLive}
          mainCount={mainComps.length}
          communityCount={communityComps.length}
        />

        <Modal isOpen={reportModal} onClose={() => !sendingReport && setReportModal(false)} title="Report User">
          <div className={styles.reportModal}>
            <p className={styles.reportDesc}>Report this user to the owner.</p>
            <Input label="Report reason" placeholder="Reason..." value={reportReason} onChange={e => setReportReason(e.target.value)} />
            {reportError && <p className={styles.formError} role="alert">{reportError}</p>}
            <div className={styles.reportActions}>
              <Button variant="ghost" onClick={() => setReportModal(false)} disabled={sendingReport}>Cancel</Button>
              <Button variant="danger" onClick={async () => {
                if (!reportReason.trim()) return
                setSendingReport(true)
                setReportError('')
                try {
                  await createDocument('reports', null, {
                    reporterId: user.uid,
                    reporterName: getDisplayName(userData),
                    targetId: userId,
                    reason: reportReason.trim(),
                    status: 'open',
                    createdAt: new Date(),
                  })
                  setReportModal(false)
                  setReportReason('')
                } catch (error) {
                  console.error(error)
                  setReportError(error?.message || 'The report could not be sent. Please try again.')
                } finally { setSendingReport(false) }
              }} loading={sendingReport} disabled={!reportReason.trim()}>
                Send Report
              </Button>
            </div>
          </div>
        </Modal>

        <Modal isOpen={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Delete Record">
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
            {deleteError && <p className={styles.deleteError}>{deleteError}</p>}
            <div className={styles.reportActions}>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteCompletion} loading={deleting} icon={Trash2}>
                Delete Record
              </Button>
            </div>
          </div>
        </Modal>

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
                    {isAdmin && (
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
                    {isAdmin && (
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
      </div>
    </PageShell>
  )
}
