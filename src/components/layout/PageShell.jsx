import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import styles from './PageShell.module.css'

export default function PageShell({ title, subtitle, children, className = '' }) {
  const generatedId = useId()
  const titleId = `page-title-${generatedId.replace(/:/g, '')}`
  const reduceMotion = useReducedMotion()

  return (
    <motion.main
      id="main-content"
      className={`${styles.shell} ${className}`}
      tabIndex={-1}
      aria-labelledby={title ? titleId : undefined}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.3 }}
    >
      {(title || subtitle) && (
        <div className={styles.header}>
          {title && <h1 id={titleId} className={styles.title}>{title}</h1>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      )}
      {children}
    </motion.main>
  )
}
