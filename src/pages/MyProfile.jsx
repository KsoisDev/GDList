import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Edit3, Save, X, Send, Shield } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { updateDocument, getCollection } from '../services/firestore'
import { formatNumber, formatDate } from '../utils/format'
import styles from './Profile.module.css'

export default function MyProfile() {
  const { user, userData, loading: authLoading, refreshUserData } = useAuth()
  const navigate = useNavigate()
  const [completions, setCompletions] = useState([])
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.displayName || '')
    }
  }, [userData])

  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        const comps = await getCollection('completions')
        const userComps = comps
          .filter(c => c.userId === user.uid)
          .sort((a, b) => {
            const ta = a.completedAt?.toMillis?.() || 0
            const tb = b.completedAt?.toMillis?.() || 0
            return tb - ta
          })
        setCompletions(userComps)
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
      await updateDocument('users', user.uid, { displayName: displayName.trim() })
      await refreshUserData()
      setEditing(false)
    } catch (err) {
      console.error('Failed to update profile:', err)
    } finally {
      setSaving(false)
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

  return (
    <PageShell>
      <div className={styles.profile}>
        <Card padding="lg" className={styles.header}>
          <div className={styles.headerContent}>
            <Avatar src={userData.avatarURL} alt={userData.username} size="xl" />
            <div className={styles.headerInfo}>
              {editing ? (
                <div className={styles.editRow}>
                  <Input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Display name"
                  />
                  <Button variant="primary" size="sm" onClick={handleSave} loading={saving} icon={Save}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)} icon={X}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className={styles.username}>{userData.displayName || userData.username}</h1>
                  <div className={styles.meta}>
                    <Badge variant={userData.role === 'admin' ? 'purple' : 'default'} size="sm">
                      {userData.role === 'admin' ? <Shield size={12} /> : null}
                      {userData.role === 'admin' ? 'Admin' : 'Player'}
                    </Badge>
                    <span className={styles.joinDate}>
                      Joined {formatDate(userData.createdAt)}
                    </span>
                    <div className={styles.editBtn}>
                      <Button variant="ghost" size="sm" icon={Edit3} onClick={() => setEditing(true)}>
                        Edit Profile
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        <div className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <span className={styles.statValue}>{formatNumber(stats.totalPoints || 0)}</span>
            <span className={styles.statLabel}>Total Points</span>
          </Card>
          <Card className={styles.statCard}>
            <span className={styles.statValue}>{formatNumber(stats.mainPoints || 0)}</span>
            <span className={styles.statLabel}>Main Points</span>
          </Card>
          <Card className={styles.statCard}>
            <span className={styles.statValue}>{formatNumber(stats.communityPoints || 0)}</span>
            <span className={styles.statLabel}>Community Points</span>
          </Card>
          <Card className={styles.statCard}>
            <span className={styles.statValue}>{stats.mainCompletions + stats.communityCompletions || 0}</span>
            <span className={styles.statLabel}>Completions</span>
          </Card>
        </div>

        <div className={styles.actions}>
          <Link to="/submit">
            <Button variant="primary" icon={Send}>Submit Record</Button>
          </Link>
          {userData.role === 'admin' && (
            <Link to="/admin">
              <Button variant="secondary" icon={Shield}>Admin Panel</Button>
            </Link>
          )}
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
