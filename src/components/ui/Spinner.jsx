import styles from './Spinner.module.css'

export default function Spinner({ size = 'md', label = 'Loading' }) {
  return (
    <span
      className={`${styles.spinner} ${styles[size]}`}
      role="status"
      aria-live="polite"
      aria-label={label}
      aria-busy="true"
    />
  )
}
