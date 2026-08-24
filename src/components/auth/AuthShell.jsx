import { CheckCircle2, Layers3, ShieldCheck, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './AuthShell.module.css'

const benefits = [
  { icon: Trophy, text: 'Track completions and ranking progress' },
  { icon: Layers3, text: 'Submit records and community levels' },
  { icon: ShieldCheck, text: 'Review status and account notifications' },
]

export default function AuthShell({ children, compact = false }) {
  return (
    <main className={styles.page}>
      <div className={`${styles.frame} ${compact ? styles.compact : ''}`}>
        <aside className={styles.brandPanel} aria-label="Basement List account benefits">
          <Link to="/" className={styles.wordmark}>
            <span className={styles.mark}><CheckCircle2 size={20} /></span>
            <span>Basement List</span>
          </Link>
          <div className={styles.brandCopy}>
            <span className={styles.eyebrow}>Player access</span>
            <h1>One account.<br />Every climb.</h1>
            <p>Join the community ranking the toughest Geometry Dash levels from the basement up.</p>
          </div>
          <ul className={styles.benefits}>
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span><Icon size={17} /></span>
                {text}
              </li>
            ))}
          </ul>
          <p className={styles.communityNote}>Built for the Geometry Dash community.</p>
        </aside>
        <section className={styles.contentPanel}>{children}</section>
      </div>
    </main>
  )
}
