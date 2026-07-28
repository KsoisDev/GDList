import styles from './Spinner.module.css'

export default function Spinner({ size = 'md' }) {
  return <span className={`${styles.spinner} ${styles[size]}`} />
}
