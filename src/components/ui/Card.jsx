import { motion } from 'framer-motion'
import styles from './Card.module.css'

export default function Card({
  children,
  className = '',
  variant = 'default',
  hover = true,
  onClick,
  padding = 'md',
}) {
  const cls = [
    styles.card,
    styles[variant],
    styles[`pad-${padding}`],
    hover ? styles.hover : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <motion.div
      className={cls}
      onClick={onClick}
      whileHover={hover && onClick ? { scale: 1.01 } : {}}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}
