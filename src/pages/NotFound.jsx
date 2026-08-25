import { Home } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Button from '../components/ui/Button'
import theme from '../components/layout/ThemedPage.module.css'
import styles from './NotFound.module.css'

export default function NotFound() {
  return (
    <PageShell className={theme.pageShell}>
      <div className={theme.glow} aria-hidden="true" />
      <div className={styles.page}>
        <h1 className={styles.code}>404</h1>
        <p className={styles.text}>Page not found</p>
        <Button to="/" variant="primary" icon={Home}>Go Home</Button>
      </div>
    </PageShell>
  )
}
