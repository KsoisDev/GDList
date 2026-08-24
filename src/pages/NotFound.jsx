import { Home } from 'lucide-react'
import Button from '../components/ui/Button'
import styles from './NotFound.module.css'

export default function NotFound() {
  return (
    <div className={styles.page}>
      <h1 className={styles.code}>404</h1>
      <p className={styles.text}>Page not found</p>
      <Button to="/" variant="primary" icon={Home}>Go Home</Button>
    </div>
  )
}
