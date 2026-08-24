import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, User as UserIcon, Ban, Flag, Crown } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Avatar from '../../components/ui/Avatar'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import { useAuth } from '../../hooks/useAuth'
import { getCollection, updateDocument, createDocument } from '../../services/firestore'
import { formatNumber, getDisplayName } from '../../utils/format'
import { getFlagUrl } from '../../utils/countries'
import { hasAccess } from '../../utils/constants'
import styles from './Admin.module.css'

export default function ManageUsers() {
  const { user, userData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [reportModal, setReportModal] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [sending, setSending] = useState(false)

  const role = userData?.role || 'user'
  const isOwner = role === 'owner'
  const isAdmin = hasAccess(role, 'admin')

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/')
  }, [user, userData, authLoading, navigate, isAdmin])

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
    if (isAdmin) load()
  }, [userData, isAdmin])

  const toggleRole = async (uid, currentRole) => {
    if (!isOwner) return
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    try {
      await updateDocument('users', uid, { role: newRole })
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u))
    } catch (err) {
      console.error(err)
    }
  }

  const toggleBan = async (uid, currentBanned) => {
    if (!isOwner) return
    try {
      await updateDocument('users', uid, { banned: !currentBanned })
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, banned: !currentBanned } : u))
    } catch (err) {
      console.error(err)
    }
  }

  const handleReport = async () => {
    if (!reportReason.trim() || !reportModal) return
    setSending(true)
    try {
      await createDocument('reports', null, {
        reporterId: user.uid,
        reporterName: getDisplayName(userData),
        targetId: reportModal,
        reason: reportReason.trim(),
        status: 'open',
        createdAt: new Date(),
      })
      setReportModal(null)
      setReportReason('')
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.01 }}
            style={u.banned ? { opacity: 0.5 } : {}}
          >
            <span className={styles.userCell}>
              <Link to={`/profile/${u.id}`} className={styles.userLink}>
                <Avatar src={u.avatarURL} alt={getDisplayName(u)} size="sm" />
                <span>{getDisplayName(u)}</span>
                {getFlagUrl(u.country) && (
                  <img src={getFlagUrl(u.country)} alt={u.country} className={styles.flagImg} loading="lazy" />
                )}
                {u.banned && <Badge variant="danger" size="sm">Banned</Badge>}
              </Link>
            </span>
            <span>
              <Badge variant={u.role === 'owner' ? 'gold' : u.role === 'admin' ? 'purple' : 'default'} size="sm">
                {u.role === 'owner' ? <Crown size={12} /> : u.role === 'admin' ? <Shield size={12} /> : <UserIcon size={12} />}
                {u.role}
              </Badge>
            </span>
            <span className={styles.points}>{formatNumber(u.stats?.totalPoints || 0)}</span>
            <span>{(u.stats?.mainCompletions || 0) + (u.stats?.communityCompletions || 0)}</span>
            <span className={styles.actionButtons}>
              {u.id !== user.uid && (
                <>
                  {isOwner && u.role !== 'owner' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRole(u.id, u.role)}
                      >
                        {u.role === 'admin' ? 'Demote' : 'Promote'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleBan(u.id, u.banned)}
                        icon={Ban}
                        style={{ color: u.banned ? 'var(--accent-green)' : 'var(--accent-red)' }}
                      >
                        {u.banned ? 'Unban' : 'Ban'}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Flag}
                    onClick={() => setReportModal(u.id)}
                  >
                    Report
                  </Button>
                </>
              )}
            </span>
          </motion.div>
        ))}
      </div>

      <Modal isOpen={!!reportModal} onClose={() => setReportModal(null)} title="Report User">
        <div className={styles.reportModal}>
          <p className={styles.reportDesc}>
            Report this user to the owner. Provide a reason for the report.
          </p>
          <Input
            label="Report reason"
            placeholder="Reason for report..."
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
          />
          <div className={styles.reportActions}>
            <Button variant="ghost" onClick={() => setReportModal(null)} disabled={sending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleReport} loading={sending} disabled={!reportReason.trim()}>
              Send Report
            </Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  )
}
