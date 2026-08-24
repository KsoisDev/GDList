import Spinner from '../ui/Spinner'
import styles from './RouteLoader.module.css'

export default function RouteLoader() {
  return (
    <main id="main-content" className={styles.loader} aria-busy="true">
      <Spinner size="lg" label="Loading page" />
      <span>Loading page…</span>
    </main>
  )
}
