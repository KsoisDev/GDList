import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LogOut, User, Shield, ChevronDown, Plus, Bell, Check, X as XIcon, Clock, Flag } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { logout } from '../../services/auth'
import { getCollection, updateDocument, where } from '../../services/firestore'
import { NAV_LINKS, hasAccess } from '../../utils/constants'
import { formatDateRelative, getDisplayName } from '../../utils/format'
import { getFlagUrl } from '../../utils/countries'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import styles from './Navbar.module.css'

export default function Navbar() {
  const { user, userData } = useAuth()
  const { maintenance } = useSiteConfig()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationError, setNotificationError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const notifRef = useRef(null)
  const profileRef = useRef(null)

  const isActive = (path) => location.pathname === path
  const accountSuspended = userData?.banned === true
  const canSubmit = !accountSuspended && (!maintenance || hasAccess(userData?.role || 'user', 'admin'))

  useEffect(() => {
    if (!user || !userData || accountSuspended) {
      setNotifications([])
      setNotificationError('')
      return undefined
    }
    let mounted = true
    async function load() {
      try {
        const scoped = await getCollection('notifications', [where('userId', '==', user.uid)])
        if (!mounted) return
        const userNotifs = scoped.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0
          const tb = b.createdAt?.toMillis?.() || 0
          return tb - ta
        })
        setNotifications(userNotifs.slice(0, 30))
        setNotificationError('')
      } catch (error) {
        if (!mounted) return
        console.error('Failed to load notifications:', error)
        setNotificationError('Notifications are temporarily unavailable.')
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => { mounted = false; clearInterval(interval) }
  }, [user, userData?.id, accountSuspended])

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setProfileOpen(false)
      setNotifOpen(false)
      setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    setOpen(false)
    setProfileOpen(false)
    setNotifOpen(false)
  }, [location.pathname])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = async (notifId) => {
    try {
      await updateDocument('notifications', notifId, { read: true })
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      setNotificationError('Could not update that notification.')
    }
  }

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read)
    try {
      await Promise.all(unread.map(n => updateDocument('notifications', n.id, { read: true })))
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) {
      console.error('Failed to mark notifications as read:', error)
      setNotificationError('Could not update notifications.')
    }
  }

  const handleNotification = async (notification) => {
    if (!notification.read) await markAsRead(notification.id)
    setNotifOpen(false)
    navigate(notification.levelId ? `/levels/${notification.levelId}` : '/profile')
  }

  const handleLogout = async () => {
    setSigningOut(true)
    try {
      await logout()
      setProfileOpen(false)
      setOpen(false)
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Sign out failed:', error)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <nav className={styles.navbar} aria-label="Primary navigation">
      <div className={styles.container}>
        <Link to="/" className={styles.logo} aria-label="Basement List home">
          <span className={styles.logoText}>Basement List</span>
          <span className={styles.logoAccent}>GD</span>
        </Link>

        <div className={styles.desktopNav}>
          {NAV_LINKS.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`${styles.navLink} ${isActive(link.path) ? styles.active : ''}`}
            >
              {link.label}
            </Link>
          ))}
          <div className={styles.navDivider} />
          {canSubmit && (
            <>
              <Link to="/submit" className={styles.submitBtn}>
                <Plus size={15} />
                Record
              </Link>
              <Link to="/submit-level" className={styles.submitBtn}>
                <Plus size={15} />
                Level
              </Link>
            </>
          )}
        </div>

        <div className={styles.actions}>
          {user ? (
            <>
              {!accountSuspended && <div className={styles.bellWrapper} ref={notifRef}>
                <button
                  type="button"
                  className={styles.bellBtn}
                  onClick={() => { setNotifOpen(value => !value); setProfileOpen(false) }}
                  aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                  aria-expanded={notifOpen}
                  aria-controls="notification-menu"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className={styles.bellBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </button>
                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      className={styles.notifDropdown}
                      id="notification-menu"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <div className={styles.notifHeader}>
                        <span className={styles.notifTitle}>Notifications</span>
                        {unreadCount > 0 && (
                          <button className={styles.notifMarkAll} onClick={markAllAsRead}>
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className={styles.notifList}>
                        {notificationError ? (
                          <div className={styles.notifEmpty} role="status">{notificationError}</div>
                        ) : notifications.length === 0 ? (
                          <div className={styles.notifEmpty}>No notifications yet</div>
                        ) : (
                          notifications.map(n => (
                            <button
                              type="button"
                              key={n.id}
                              className={`${styles.notifItem} ${!n.read ? styles.notifUnread : ''}`}
                              onClick={() => handleNotification(n)}
                            >
                              <span className={styles.notifIcon}>
                                {n.type === 'approved' ? (
                                  <Check size={16} style={{ color: 'var(--accent-green)' }} />
                                ) : (
                                  <XIcon size={16} style={{ color: 'var(--accent-red)' }} />
                                )}
                              </span>
                              <div className={styles.notifBody}>
                                <span className={styles.notifType}>
                                  {n.type === 'approved' ? 'Approved' : 'Rejected'}
                                </span>
                                <span className={styles.notifLevel}>{n.levelName}</span>
                                {n.reviewNote && (
                                  <span className={styles.notifNote}>"{n.reviewNote}"</span>
                                )}
                                <span className={styles.notifTime}>
                                  <Clock size={12} />
                                  {formatDateRelative(n.createdAt)}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>}
              <div className={styles.profileWrapper} ref={profileRef}>
                <button
                  type="button"
                  className={styles.profileBtn}
                  onClick={() => { setProfileOpen(value => !value); setNotifOpen(false) }}
                  aria-label="Open account menu"
                  aria-expanded={profileOpen}
                  aria-controls="profile-menu"
                >
                  <Avatar src={userData?.avatarURL} alt={getDisplayName(userData) || 'User'} size="sm" />
                  <span className={styles.username}>{getDisplayName(userData) || 'User'}</span>
                  {getFlagUrl(userData?.country) && (
                    <img src={getFlagUrl(userData?.country)} alt={userData?.country} className={styles.flagImg} loading="lazy" />
                  )}
                  <ChevronDown size={14} />
                </button>
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      className={styles.dropdown}
                      id="profile-menu"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <Link to="/profile" className={styles.dropdownItem}>
                        <User size={16} /> My Profile
                      </Link>
                      {!accountSuspended && hasAccess(userData?.role || 'user', 'admin') && (
                        <Link to="/admin" className={styles.dropdownItem}>
                          <Shield size={16} /> Admin Panel
                        </Link>
                      )}
                      {!accountSuspended && hasAccess(userData?.role || 'user', 'owner') && (
                        <Link to="/admin/reports" className={styles.dropdownItem}>
                          <Flag size={16} /> Reports
                        </Link>
                      )}
                      <button
                        className={`${styles.dropdownItem} ${styles.signOutItem}`}
                        onClick={handleLogout}
                        disabled={signingOut}
                      >
                        <LogOut size={16} /> {signingOut ? 'Signing Out…' : 'Sign Out'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className={styles.authButtons}>
              <Button to="/login" variant="ghost" size="sm">Sign In</Button>
              <Button to="/register" variant="primary" size="sm">Join</Button>
            </div>
          )}
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setOpen(value => !value)}
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.mobileNav}
            id="mobile-navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {NAV_LINKS.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`${styles.mobileLink} ${isActive(link.path) ? styles.active : ''}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {canSubmit && (
              <>
                <Link to="/submit" className={styles.mobileSubmitBtn} onClick={() => setOpen(false)}>
                  <Plus size={16} />
                  Submit Record
                </Link>
                <Link to="/submit-level" className={styles.mobileSubmitBtn} onClick={() => setOpen(false)}>
                  <Plus size={16} />
                  Submit Level
                </Link>
              </>
            )}
            {user ? (
              <>
                <Link to="/profile" className={styles.mobileLink} onClick={() => setOpen(false)}>
                  <User size={16} /> My Profile
                </Link>
                {!accountSuspended && hasAccess(userData?.role || 'user', 'admin') && (
                  <Link to="/admin" className={styles.mobileLink} onClick={() => setOpen(false)}>
                    <Shield size={16} /> Admin Panel
                  </Link>
                )}
                <button className={styles.mobileLink} onClick={handleLogout} disabled={signingOut}>
                  <LogOut size={16} /> {signingOut ? 'Signing Out…' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={styles.mobileLink} onClick={() => setOpen(false)}>Sign In</Link>
                <Link to="/register" className={styles.mobileLink} onClick={() => setOpen(false)}>Create Account</Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
