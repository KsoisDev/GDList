import { motion } from 'framer-motion'
import styles from './PageShell.module.css'

export default function PageShell({ title, subtitle, children, className = '' }) {
  return (
    <motion.div
      className={`${styles.shell} ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {(title || subtitle) && (
        <div className={styles.header}>
          {title && <h1 className={styles.title}>{title}</h1>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      )}
      {children}
    </motion.div>
  )
}
