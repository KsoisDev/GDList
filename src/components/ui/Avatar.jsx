import styles from './Avatar.module.css'

export default function Avatar({ src, alt, size = 'md', className = '' }) {
  const cls = [styles.avatar, styles[size], className].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      <img src={src} alt={alt} className={styles.img} />
    </div>
  )
}
