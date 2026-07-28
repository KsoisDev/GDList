import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, User as UserIcon } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Avatar from '../../components/ui/Avatar'
import { useAuth } from '../../hooks/useAuth'
import { getCollection, updateDocument } from '../../services/firestore'
import { formatNumber } from '../../utils/format'
import styles from './Admin.module.css'

export default function ManageUsers() {
  const { user, userData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || userData?.role !== 'admin')) navigate('/')
  }, [user, userData, authLoading, navigate])

  useEffect(() => {
    async function load() {
      try {
        const data = await getCollection('users')
        setUsers(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (userData?.role === 'admin') load()
  }, [userData])

  const toggleRole = async (uid, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    try {
      await updateDocument('users', uid, { role: newRole })
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u))
    } catch (err) {
      console.error(err)
    }
  }

  if (authLoading || loading) {
    return <PageShell><div className={styles.loading}><Spinner size="lg" /></div></PageShell>
  }

  return (
    <PageShell title="Manage Users" subtitle={`${users.length} registered users`}>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>User</span>
          <span>Role</span>
          <span>Points</span>
          <span>Completions</span>
          <span>Actions</span>
        </div>
        {users.map((u, i) => (
          <motion.div key={u.id} className={styles.tableRow}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
          >
            <span className={styles.userCell}>
              <Link to={`/profile/${u.id}`} className={styles.userLink}>
                <Avatar src={u.avatarURL} alt={u.username} size="sm" />
                <span>{u.username}</span>
              </Link>
            </span>
            <span>
              <Badge variant={u.role === 'admin' ? 'purple' : 'default'} size="sm">
                {u.role === 'admin' ? <Shield size={12} /> : <UserIcon size={12} />}
                {u.role}
              </Badge>
            </span>
            <span className={styles.points}>{formatNumber(u.stats?.totalPoints || 0)}</span>
            <span>{(u.stats?.mainCompletions || 0) + (u.stats?.communityCompletions || 0)}</span>
            <span>
              {u.id !== user.uid && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleRole(u.id, u.role)}
                >
                  {u.role === 'admin' ? 'Demote' : 'Promote'}
                </Button>
              )}
            </span>
          </motion.div>
        ))}
      </div>
    </PageShell>
  )
}
