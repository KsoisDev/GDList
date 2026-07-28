import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LogOut, User, Shield, ChevronDown, Plus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { logout } from '../../services/auth'
import { NAV_LINKS } from '../../utils/constants'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import styles from './Navbar.module.css'

export default function Navbar() {
  const { user, userData } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const isActive = (path) => location.pathname === path

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoText}>WebList</span>
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
          <Link to="/submit" className={styles.submitNavBtn}>
            <Plus size={16} />
            Submit Record
          </Link>
        </div>

        <div className={styles.actions}>
          {user ? (
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
                    {userData?.role === 'admin' && (
                      <Link to="/admin" className={styles.dropdownItem}>
                        <Shield size={16} /> Admin Panel
                      </Link>
                    )}
                    <button className={styles.dropdownItem} onClick={logout}>
                      <LogOut size={16} /> Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
