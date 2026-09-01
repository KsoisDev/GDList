import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, User, Shield, ChevronDown, Plus, Bell, Check, X as XIcon, Clock, Flag } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { useLanguage } from '../../hooks/useLanguage'
import { logout } from '../../services/auth'
import { getCollection, updateDocument, where } from '../../services/firestore'
import { NAV_LINKS, hasAccess } from '../../utils/constants'
import { formatDateRelative, getDisplayName } from '../../utils/format'
import { getFlagUrl } from '../../utils/countries'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import LanguageSelector from './LanguageSelector'
import styles from './Navbar.module.css'

export default function Navbar() {
  const { user, userData } = useAuth()
  const { maintenance } = useSiteConfig()
  const { t, locale } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
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
        setNotificationError(t('nav.notificationsUnavailable'))
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => { mounted = false; clearInterval(interval) }
  }, [user, userData?.id, accountSuspended, t])

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
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
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
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Sign out failed:', error)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <nav className={styles.navbar} aria-label={t('nav.primary')}>
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
              {t(link.labelKey)}
            </Link>
          ))}
          <div className={styles.navDivider} />
          {canSubmit && (
            <>
              <Link to="/submit" className={styles.submitBtn}>
                <Plus size={15} />
                {t('nav.record')}
              </Link>
              <Link to="/submit-level" className={styles.submitBtn}>
                <Plus size={15} />
                {t('nav.level')}
              </Link>
            </>
          )}
        </div>

        <div className={styles.actions}>
          <LanguageSelector compact />
          {user ? (
            <>
              {!accountSuspended && <div className={styles.bellWrapper} ref={notifRef}>
                <button
                  type="button"
                  className={styles.bellBtn}
                  onClick={() => { setNotifOpen(value => !value); setProfileOpen(false) }}
                  aria-label={unreadCount ? t('nav.notificationsUnread', { count: unreadCount }) : t('nav.notifications')}
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
                        <span className={styles.notifTitle}>{t('nav.notifications')}</span>
                        {unreadCount > 0 && (
                          <button className={styles.notifMarkAll} onClick={markAllAsRead}>
                            {t('nav.markAllRead')}
                          </button>
                        )}
                      </div>
                      <div className={styles.notifList}>
                        {notificationError ? (
                          <div className={styles.notifEmpty} role="status">{notificationError}</div>
                        ) : notifications.length === 0 ? (
                          <div className={styles.notifEmpty}>{t('nav.noNotifications')}</div>
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
                                  {n.type === 'approved' ? t('nav.approved') : t('nav.rejected')}
                                </span>
                                <span className={styles.notifLevel}>{n.levelName}</span>
                                {n.reviewNote && (
                                  <span className={styles.notifNote}>"{n.reviewNote}"</span>
                                )}
                                <span className={styles.notifTime}>
                                  <Clock size={12} />
                                  {formatDateRelative(n.createdAt, locale)}
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
                  aria-label={t('nav.openAccount')}
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
                        <User size={16} /> {t('nav.myProfile')}
                      </Link>
                      {!accountSuspended && hasAccess(userData?.role || 'user', 'admin') && (
                        <Link to="/admin" className={styles.dropdownItem}>
                          <Shield size={16} /> {t('nav.adminPanel')}
                        </Link>
                      )}
                      {!accountSuspended && hasAccess(userData?.role || 'user', 'owner') && (
                        <Link to="/admin/reports" className={styles.dropdownItem}>
                          <Flag size={16} /> {t('nav.reports')}
                        </Link>
                      )}
                      <button
                        className={`${styles.dropdownItem} ${styles.signOutItem}`}
                        onClick={handleLogout}
                        disabled={signingOut}
                      >
                        <LogOut size={16} /> {signingOut ? t('nav.signingOut') : t('nav.signOut')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className={styles.authButtons}>
              <Button to="/login" variant="ghost" size="sm">{t('nav.signIn')}</Button>
              <Button to="/register" variant="primary" size="sm">{t('nav.join')}</Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
