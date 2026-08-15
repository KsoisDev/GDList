import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { Calendar, Trophy, Medal, List, Youtube, Flag, Crown, Shield } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Avatar from '../components/ui/Avatar'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { getDocument, getCollection, createDocument, where } from '../services/firestore'
import { communityPoints } from '../utils/communityPoints'
import { computeBadges } from '../utils/badges'
import { formatNumber, formatDate } from '../utils/format'
import { hasAccess } from '../utils/constants'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import styles from './Profile.module.css'

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

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const uid = userId
        const userData = await getDocument('users', uid)
        setProfile(userData)

        if (userData) {
          const comps = await getCollection('completions')
          const userComps = comps
            .filter(c => c.userId === uid)
            .sort((a, b) => {
              const ta = a.completedAt?.toMillis?.() || 0
              const tb = b.completedAt?.toMillis?.() || 0
              return tb - ta
            })

          const communityLevels = await getCollection('levels', [where('type', '==', 'community')])
          const posMap = {}
          communityLevels.forEach(l => { posMap[l.id] = l.position })

          const withLivePoints = userComps.map(c => {
            if (c.levelType === 'community') {
              const pos = posMap[c.levelId]
              if (pos) return { ...c, points: communityPoints(pos) }
            }
            return c
          })

          setCompletions(withLivePoints)
          setBadges(computeBadges(communityLevels, uid))
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    if (userId) load()
  }, [userId])

  const mainComps = completions.filter(c => c.levelType === 'main')
  const communityComps = completions.filter(c => c.levelType === 'community')

  if (loading) {
    return (
      <PageShell>
        <div className={styles.loading}><Spinner size="lg" /></div>
      </PageShell>
    )
  }

  if (!profile) {
    return (
      <PageShell title="User Not Found">
        <p>This user does not exist.</p>
      </PageShell>
    )
  }

  const stats = profile.stats || {}
  const mainPoints = stats.mainPoints || 0
  const communityPointsLive = communityComps.reduce((sum, c) => sum + (c.points || 0), 0)
  const totalPointsLive = parseFloat((mainPoints + communityPointsLive).toFixed(2))

  return (
    <PageShell>
      <div className={styles.profile}>
        <Card padding="lg" className={styles.header}>
          <div className={styles.headerContent}>
            <Avatar src={profile.avatarURL} alt={profile.username} size="xl" />
            <div className={styles.headerInfo}>
              <h1 className={styles.username}>{profile.username}</h1>
              <div className={styles.meta}>
                <Badge variant={profile.role === 'owner' ? 'gold' : profile.role === 'admin' ? 'purple' : 'default'} size="sm">
                  {profile.banned ? 'Banned' : profile.role === 'owner' ? <><Crown size={12} /> Owner</> : profile.role === 'admin' ? <><Shield size={12} /> Admin</> : 'Player'}
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
                  <Calendar size={14} /> Joined {formatDate(profile.createdAt)}
                </span>
              </div>
            </div>
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

        {user && user.uid !== userId && hasAccess(userData?.role || 'user', 'admin') && (
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" icon={Flag} onClick={() => setReportModal(true)}>
              Report User
            </Button>
          </div>
        )}

        <Modal isOpen={reportModal} onClose={() => setReportModal(false)} title="Report User">
          <div className={styles.reportModal}>
            <p className={styles.reportDesc}>Report this user to the owner.</p>
            <Input placeholder="Reason..." value={reportReason} onChange={e => setReportReason(e.target.value)} />
            <div className={styles.reportActions}>
              <Button variant="ghost" onClick={() => setReportModal(false)} disabled={sendingReport}>Cancel</Button>
              <Button variant="danger" onClick={async () => {
                if (!reportReason.trim()) return
                setSendingReport(true)
                try {
                  await createDocument('reports', null, {
                    reporterId: user.uid,
                    reporterName: userData?.username || 'Unknown',
                    targetId: userId,
                    reason: reportReason.trim(),
                    status: 'open',
                    createdAt: new Date(),
                  })
                  setReportModal(false)
                  setReportReason('')
                } catch (e) { console.error(e) } finally { setSendingReport(false) }
              }} loading={sendingReport} disabled={!reportReason.trim()}>
                Send Report
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
      </div>
    </PageShell>
  )
}
