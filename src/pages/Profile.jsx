import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, Trophy, Medal, List } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Avatar from '../components/ui/Avatar'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { getDocument, getCollection } from '../services/firestore'
import { formatNumber, formatDate } from '../utils/format'
import styles from './Profile.module.css'

export default function Profile() {
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)

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
          setCompletions(userComps)
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    if (userId) load()
  }, [userId])

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

  return (
    <PageShell>
      <div className={styles.profile}>
        <Card padding="lg" className={styles.header}>
          <div className={styles.headerContent}>
            <Avatar src={profile.avatarURL} alt={profile.username} size="xl" />
            <div className={styles.headerInfo}>
              <h1 className={styles.username}>{profile.username}</h1>
              <div className={styles.meta}>
                <Badge variant={profile.role === 'admin' ? 'purple' : 'default'} size="sm">
                  {profile.role === 'admin' ? 'Admin' : 'Player'}
                </Badge>
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
            <span className={styles.statValue}>{formatNumber(stats.totalPoints || 0)}</span>
            <span className={styles.statLabel}>Total Points</span>
          </Card>
          <Card className={styles.statCard}>
            <Medal size={20} className={styles.statIcon} style={{ color: 'var(--accent-green)' }} />
            <span className={styles.statValue}>{formatNumber(stats.mainPoints || 0)}</span>
            <span className={styles.statLabel}>Main Points</span>
          </Card>
          <Card className={styles.statCard}>
            <Medal size={20} className={styles.statIcon} style={{ color: 'var(--accent-blue)' }} />
            <span className={styles.statValue}>{formatNumber(stats.communityPoints || 0)}</span>
            <span className={styles.statLabel}>Community Points</span>
          </Card>
          <Card className={styles.statCard}>
            <List size={20} className={styles.statIcon} style={{ color: 'var(--accent-purple)' }} />
            <span className={styles.statValue}>{stats.mainCompletions + stats.communityCompletions || 0}</span>
            <span className={styles.statLabel}>Completions</span>
          </Card>
        </div>

        {completions.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent Completions</h2>
            <div className={styles.completions}>
              {completions.slice(0, 10).map((comp, i) => (
                <motion.div
                  key={comp.id}
                  className={styles.completion}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className={styles.compInfo}>
                    <Badge variant={comp.levelType === 'main' ? 'green' : 'blue'} size="sm">
                      {comp.levelType === 'main' ? 'Main' : 'Community'}
                    </Badge>
                    <span className={styles.compLevel}>{comp.levelName || 'Unknown Level'}</span>
                  </div>
                  <span className={styles.compPoints}>+{comp.points} pts</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
