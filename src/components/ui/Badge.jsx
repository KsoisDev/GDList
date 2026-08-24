import styles from './Badge.module.css'

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  ...rest
}) {
  const cls = [styles.badge, styles[variant], styles[size], className].filter(Boolean).join(' ')
  return <span className={cls} {...rest}>{children}</span>
}
