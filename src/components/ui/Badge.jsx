import styles from './Badge.module.css'

export default function Badge({ children, variant = 'default', size = 'sm' }) {
  const cls = [styles.badge, styles[variant], styles[size]].filter(Boolean).join(' ')
  return <span className={cls}>{children}</span>
}
