import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LogOut, User, Shield, ChevronDown, Plus, Bell, Check, X as XIcon, Clock, Flag } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { logout } from '../../services/auth'
import { getCollection, updateDocument } from '../../services/firestore'
import { NAV_LINKS, hasAccess } from '../../utils/constants'
import { formatDateRelative } from '../../utils/format'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import styles from './Navbar.module.css'

export default function Navbar() {
  const { user, userData } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const notifRef = useRef(null)

  const isActive = (path) => location.pathname === path

  useEffect(() => {
    if (!user) { setNotifications([]); return }
    let mounted = true
    async function load() {
      const all = await getCollection('notifications')
      if (!mounted) return
      const userNotifs = all
        .filter(n => n.userId === user.uid)
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0
          const tb = b.createdAt?.toMillis?.() || 0
          return tb - ta
        })
      setNotifications(userNotifs)
    }
    load()
    const interval = setInterval(load, 15000)
    return () => { mounted = false; clearInterval(interval) }
  }, [user])

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = async (notifId) => {
    await updateDocument('notifications', notifId, { read: true })
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
  }

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read)
    await Promise.all(unread.map(n => updateDocument('notifications', n.id, { read: true })))
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
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
          <Link to="/submit" className={styles.submitBtn}>
            <Plus size={15} />
            Record
          </Link>
          <Link to="/submit-level" className={styles.submitBtn}>
            <Plus size={15} />
            Level
          </Link>
        </div>

        <div className={styles.actions}>
          {user ? (
            <>
              <div className={styles.bellWrapper} ref={notifRef}>
                <button
                  className={styles.bellBtn}
                  onClick={() => setNotifOpen(!notifOpen)}
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
                        {notifications.length === 0 ? (
                          <div className={styles.notifEmpty}>No notifications yet</div>
                        ) : (
                          notifications.map(n => (
                            <div
                              key={n.id}
                              className={`${styles.notifItem} ${!n.read ? styles.notifUnread : ''}`}
                              onClick={() => !n.read && markAsRead(n.id)}
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
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className={styles.profileWrapper}>
                <button
                  className={styles.profileBtn}
                  onClick={() => setProfileOpen(!profileOpen)}
                >
                  <Avatar src={userData?.avatarURL} alt={userData?.username || 'User'} size="sm" />
                  <span className={styles.username}>{userData?.username || 'User'}</span>
                  <ChevronDown size={14} />
                </button>
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      className={styles.dropdown}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <Link to="/profile" className={styles.dropdownItem}>
                        <User size={16} /> My Profile
                      </Link>
                      {hasAccess(userData?.role || 'user', 'admin') && (
                        <Link to="/admin" className={styles.dropdownItem}>
                          <Shield size={16} /> Admin Panel
                        </Link>
                      )}
                      {userData?.role === 'owner' && (
                        <Link to="/admin/reports" className={styles.dropdownItem}>
                          <Flag size={16} /> Reports
                        </Link>
                      )}
                      <button className={styles.dropdownItem} onClick={logout}>
                        <LogOut size={16} /> Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className={styles.authButtons}>
              <Link to="/login">
                <Button variant="secondary" size="sm">Sign In</Button>
              </Link>
            </div>
          )}
          <button className={styles.menuBtn} onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.mobileNav}
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
            <Link to="/submit" className={styles.mobileSubmitBtn} onClick={() => setOpen(false)}>
              <Plus size={16} />
              Submit Record
            </Link>
            <Link to="/submit-level" className={styles.mobileSubmitBtn} onClick={() => setOpen(false)}>
              <Plus size={16} />
              Submit Level
            </Link>
            {user ? (
              <>
                <Link to="/profile" className={styles.mobileLink} onClick={() => setOpen(false)}>
                  <User size={16} /> My Profile
                </Link>
                {hasAccess(userData?.role || 'user', 'admin') && (
                  <Link to="/admin" className={styles.mobileLink} onClick={() => setOpen(false)}>
                    <Shield size={16} /> Admin Panel
                  </Link>
                )}
                <button className={styles.mobileLink} onClick={logout}>
                  <LogOut size={16} /> Sign Out
                </button>
              </>
            ) : (
              <Link to="/login" className={styles.mobileLink} onClick={() => setOpen(false)}>
                Sign In
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
