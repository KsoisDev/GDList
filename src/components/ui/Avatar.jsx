import { useEffect, useState } from 'react'
import styles from './Avatar.module.css'

export default function Avatar({ src, alt, size = 'md', className = '' }) {
  const [imageFailed, setImageFailed] = useState(!src)
  const cls = [styles.avatar, styles[size], className].filter(Boolean).join(' ')

  useEffect(() => {
    setImageFailed(!src)
  }, [src])

  const fallbackText = String(alt || '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <div className={cls}>
      {!imageFailed ? (
        <img src={src} alt={alt || 'User avatar'} className={styles.img} onError={() => setImageFailed(true)} />
      ) : (
        <span className={styles.fallback} role="img" aria-label={alt || 'User avatar'}>
          {fallbackText}
        </span>
      )}
    </div>
  )
}
