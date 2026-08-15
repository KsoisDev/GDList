import { useNavigate } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import styles from './Maintenance.module.css'

export default function Maintenance({ message }) {
  const navigate = useNavigate()
  const text = message || "We're doing some maintenance right now. Please check back soon."

  return (
    <PageShell>
      <div className={styles.wrap}>
        <Card padding="lg" className={styles.card}>
          <span className={styles.icon}>
            <Wrench size={40} />
          </span>
          <h1 className={styles.title}>Under Maintenance</h1>
          <p className={styles.message}>{text}</p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </Card>
      </div>
    </PageShell>
  )
}
