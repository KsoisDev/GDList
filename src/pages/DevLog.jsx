import { motion, useReducedMotion } from 'framer-motion'
import {
  CalendarDays,
  CheckCircle2,
  CirclePlus,
  Code2,
  Hammer,
  Rocket,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import ThemedPageHero from '../components/layout/ThemedPageHero'
import { DEV_LOG_POSTS, formatDevLogDate } from '../data/devLog'
import { useLanguage } from '../hooks/useLanguage'
import theme from '../components/layout/ThemedPage.module.css'
import styles from './DevLog.module.css'

const SECTION_ICONS = {
  added: CirclePlus,
  improved: Sparkles,
  fixed: Wrench,
  working: Hammer,
  next: Rocket,
}

export default function DevLog() {
  const { language, t } = useLanguage()
  const reduceMotion = useReducedMotion()
  const latestPost = DEV_LOG_POSTS[0]

  return (
    <PageShell className={`${theme.pageShell} ${styles.pageShell}`}>
      <div className={theme.glow} aria-hidden="true" />
      <ThemedPageHero
        eyebrow={t('devLog.eyebrow')}
        title={t('devLog.title')}
        accentTitle={t('devLog.accentTitle')}
        description={t('devLog.description')}
        stats={[
          { icon: Code2, value: DEV_LOG_POSTS.length, label: t('devLog.updates') },
          { icon: CalendarDays, value: formatDevLogDate(latestPost.date, language, { day: 'numeric', month: 'short' }), label: t('devLog.latest') },
          { icon: ShieldCheck, value: latestPost.authors.join(' + '), label: t('devLog.developers'), featured: true },
        ]}
      />

      <section className={styles.feed} aria-labelledby="dev-log-feed-title">
        <div className={styles.feedHeading}>
          <span className={styles.liveDot} aria-hidden="true" />
          <h2 id="dev-log-feed-title">{t('devLog.releaseHistory')}</h2>
        </div>

        <div className={styles.timeline}>
          {DEV_LOG_POSTS.map((post, postIndex) => (
            <motion.article
              className={styles.post}
              id={post.id}
              key={post.id}
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.42, delay: Math.min(postIndex, 4) * 0.08 }}
            >
              <span className={styles.timelineMarker} aria-hidden="true" />
              <header className={styles.postHeader}>
                <div className={styles.postMeta}>
                  <span className={styles.updateBadge}>{t(post.badgeKey)}</span>
                  <time dateTime={post.date}>
                    <CalendarDays size={14} aria-hidden="true" />
                    {formatDevLogDate(post.date, language, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </time>
                </div>
                <h2>{t(post.titleKey)}</h2>
                <p>{t(post.summaryKey)}</p>
                <span className={styles.authors}>{t('devLog.by', { names: post.authors.join(' & ') })}</span>
              </header>

              <div className={styles.sectionGrid}>
                {post.sections.map(section => {
                  const Icon = SECTION_ICONS[section.id]
                  return (
                    <section className={`${styles.changeSection} ${styles[section.id]}`} key={section.id}>
                      <h3>
                        <span><Icon size={16} aria-hidden="true" /></span>
                        {t(section.titleKey)}
                      </h3>
                      <ul>
                        {section.items.map(itemKey => (
                          <li key={itemKey}>
                            <CheckCircle2 size={14} aria-hidden="true" />
                            <span>{t(itemKey)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
            </motion.article>
          ))}
        </div>
      </section>
    </PageShell>
  )
}
