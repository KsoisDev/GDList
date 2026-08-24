import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Radio } from 'lucide-react'
import styles from './ThemedPage.module.css'

export default function ThemedPageHero({ eyebrow, title, accentTitle, description, actions = [], stats = [] }) {
  const generatedId = useId()
  const titleId = `themed-page-${generatedId.replace(/:/g, '')}`

  return (
    <section className={styles.hero} aria-labelledby={titleId}>
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}>
          <Radio size={14} aria-hidden="true" /> {eyebrow}
        </span>
        <h1 id={titleId} className={styles.title}>{title} <span>{accentTitle}</span></h1>
        <p className={styles.description}>{description}</p>
        {actions.length > 0 ? (
          <div className={styles.actions}>
            {actions.map((action, index) => (
              <Link
                key={action.to}
                to={action.to}
                className={index === 0 ? styles.primaryAction : styles.secondaryAction}
              >
                {action.label}
                {index === 0 ? <ArrowRight size={16} aria-hidden="true" /> : null}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {stats.length > 0 ? (
        <div className={styles.stats} aria-label={`${title} statistics`}>
          {stats.map(({ icon: Icon, value, label, featured }) => (
            <div className={`${styles.stat} ${featured ? styles.featuredStat : ''}`} key={label}>
              <Icon size={18} aria-hidden="true" />
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
