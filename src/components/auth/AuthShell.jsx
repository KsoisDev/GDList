import { CheckCircle2, Layers3, ShieldCheck, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './AuthShell.module.css'
import { useLanguage } from '../../hooks/useLanguage'

const benefits = [
  { icon: Trophy, textKey: 'auth.track' },
  { icon: Layers3, textKey: 'auth.submit' },
  { icon: ShieldCheck, textKey: 'auth.review' },
]

export default function AuthShell({ children, compact = false }) {
  const { t } = useLanguage()
  return (
    <main className={styles.page}>
      <div className={`${styles.frame} ${compact ? styles.compact : ''}`}>
        <aside className={styles.brandPanel} aria-label="Basement List account benefits">
          <Link to="/" className={styles.wordmark}>
            <span className={styles.mark}><CheckCircle2 size={20} /></span>
            <span>Basement List</span>
          </Link>
          <div className={styles.brandCopy}>
            <span className={styles.eyebrow}>{t('auth.playerAccess')}</span>
            <h1>{t('auth.headline')}</h1>
            <p>{t('auth.description')}</p>
          </div>
          <ul className={styles.benefits}>
            {benefits.map(({ icon: Icon, textKey }) => (
              <li key={textKey}>
                <span><Icon size={17} /></span>
                {t(textKey)}
              </li>
            ))}
          </ul>
          <p className={styles.communityNote}>{t('auth.communityNote')}</p>
        </aside>
        <section className={styles.contentPanel}>{children}</section>
      </div>
    </main>
  )
}
