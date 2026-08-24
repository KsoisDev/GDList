import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import styles from './Button.module.css'

const MotionLink = motion.create(Link)

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  onClick,
  type = 'button',
  disabled = false,
  loading = false,
  href,
  to,
  fullWidth = false,
  className = '',
  ...rest
}) {
  const reduceMotion = useReducedMotion()
  const cls = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    className,
  ].filter(Boolean).join(' ')

  const content = (
    <>
      {loading ? (
        <span className={styles.spinner} />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
      ) : null}
      {children && <span>{children}</span>}
    </>
  )

  if (href) {
    return (
      <motion.a
        href={href}
        className={cls}
        {...rest}
        whileHover={reduceMotion ? {} : { scale: 1.02 }}
        whileTap={reduceMotion ? {} : { scale: 0.98 }}
      >
        {content}
      </motion.a>
    )
  }

  if (to) {
    return (
      <MotionLink
        to={to}
        className={cls}
        {...rest}
        whileHover={reduceMotion ? {} : { scale: 1.02 }}
        whileTap={reduceMotion ? {} : { scale: 0.98 }}
      >
        {content}
      </MotionLink>
    )
  }

  return (
    <motion.button
      className={cls}
      onClick={onClick}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
      whileHover={!reduceMotion && !disabled ? { scale: 1.02 } : {}}
      whileTap={!reduceMotion && !disabled ? { scale: 0.98 } : {}}
    >
      {content}
    </motion.button>
  )
}
