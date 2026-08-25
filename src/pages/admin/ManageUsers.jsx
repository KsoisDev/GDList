import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Ban, Code2, Flag } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import RoleBadge from '../../components/profile/RoleBadge'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Avatar from '../../components/ui/Avatar'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import { useAuth } from '../../hooks/useAuth'
import { getCollection, updateDocument, updateUserRole, updateUserDeveloperFlag, createDocument } from '../../services/firestore'
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
  const [actionError, setActionError] = useState('')

  const role = userData?.role || 'user'
  const isOwner = hasAccess(role, 'owner')
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

  const setRole = async (target, nextRole) => {
    if (!isOwner) return
    setActionError('')
    try {
      await updateUserRole(target.id, nextRole)
      setUsers(prev => prev.map(u => u.id === target.id ? { ...u, role: nextRole } : u))
    } catch (err) {
      console.error(err)
      setActionError(err?.message || 'The role could not be updated.')
    }
  }

  const toggleDeveloper = async target => {
    if (!isOwner) return
    setActionError('')
    try {
      const next = !target.isDeveloper
      await updateUserDeveloperFlag(target.id, next, getDisplayName(target))
      setUsers(prev => prev.map(u => u.id === target.id ? { ...u, isDeveloper: next } : u))
    } catch (err) {
      console.error(err)
      setActionError(err?.message || 'The developer badge could not be updated.')
    }
  }

  const toggleBan = async (uid, currentBanned) => {
    if (!isOwner) return
    try {
      await updateDocument('users', uid, { banned: !currentBanned })
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, banned: !currentBanned } : u))
    } catch (err) {
      console.error(err)
      setActionError(err?.message || 'The account status could not be updated.')
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
      {actionError && <p className="errorPanel" role="alert">{actionError}</p>}
      <div className={`${styles.table} ${styles.usersTable}`}>
        <div className={`${styles.tableHeader} ${styles.usersHeader}`}>
          <span>User</span>
          <span>Role</span>
          <span>Points</span>
          <span>Completions</span>
          <span>Actions</span>
        </div>
        {users.map((u, i) => (
          <motion.div key={u.id} className={`${styles.tableRow} ${styles.usersRow}`}
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
                {u.banned && <Badge variant="red" size="sm">Banned</Badge>}
              </Link>
            </span>
            <span className={styles.roleCell} data-label="Role">
              <RoleBadge role={u.role} username={u.username} isDeveloper={u.isDeveloper} />
            </span>
            <span className={styles.points} data-label="Points">{formatNumber(u.stats?.totalPoints || 0)}</span>
            <span className={styles.completionCell} data-label="Completions">
              {(u.stats?.mainCompletions || 0) + (u.stats?.communityCompletions || 0)}
            </span>
            <span className={styles.actionButtons}>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Code2}
                  onClick={() => toggleDeveloper(u)}
                  style={u.isDeveloper ? { color: 'var(--accent-blue)' } : undefined}
                >
                  {u.isDeveloper ? 'Remove Dev Badge' : 'Add Dev Badge'}
                </Button>
              )}
              {u.id !== user.uid && (
                <>
                  {isOwner && u.role !== 'owner' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRole(u, u.role === 'admin' ? 'user' : 'admin')}
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
