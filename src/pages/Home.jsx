import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Trophy, List, Users, Zap, Shield, Youtube, Music, Upload, Crown, Flame } from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import { getCollection } from '../services/firestore'
import { formatNumber, getDisplayName } from '../utils/format'
import { getFlagUrl } from '../utils/countries'
import styles from './Home.module.css'

const features = [
  {
    icon: List,
    title: 'Demon Lists',
    desc: 'Browse the main demon list and community-created levels.',
    link: '/list/main',
    color: 'var(--accent-green)',
  },
  {
    icon: Trophy,
    title: 'Leaderboards',
    desc: 'Compete for top spots on both main and community rankings.',
    link: '/leaderboard/main',
    color: 'var(--accent-gold)',
  },
  {
    icon: Zap,
    title: 'Submit Records',
    desc: 'Submit your completions with video proof and get verified.',
    link: '/submit',
    color: 'var(--accent-blue)',
  },
  {
    icon: Upload,
    title: 'Submit Levels',
    desc: 'Request your own levels to be added to the community list.',
    link: '/submit-level',
    color: 'var(--accent-pink)',
  },
]

export default function Home() {
  const [highlights, setHighlights] = useState({ topMain: [], topCommunity: [], recent: [], newLevels: [] })
  const [hlLoading, setHlLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      getCollection('users'),
      getCollection('completions'),
      getCollection('levels'),
    ])
      .then(([users, completions, levels]) => {
        const byUsername = Object.fromEntries(users
          .map(u => [u.id, getDisplayName(u)]))
        const topMain = users
          .filter(u => (u.stats?.mainPoints || 0) > 0)
          .sort((a, b) => (b.stats?.mainPoints || 0) - (a.stats?.mainPoints || 0))
          .slice(0, 3)
        const topCommunity = users
          .filter(u => (u.stats?.communityPoints || 0) > 0)
          .sort((a, b) => (b.stats?.communityPoints || 0) - (a.stats?.communityPoints || 0))
          .slice(0, 3)
        const recent = completions
          .filter(c => c.status !== 'rejected')
          .sort((a, b) => {
            const ta = a.completedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0
            const tb = b.completedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0
            return tb - ta
          })
          .slice(0, 5)
          .map(c => ({ ...c, username: byUsername[c.userId] || 'Unknown' }))
        const levelTime = l =>
          l.createdAt?.toMillis?.()
          || (l.victors?.[0]?.completedAt?.toMillis?.())
          || l.firstCompletedAt?.toMillis?.()
          || 0
        const newLevels = levels
          .filter(l => l.type === 'community')
          .sort((a, b) => levelTime(b) - levelTime(a))
          .slice(0, 4)
        if (mounted) {
          setHighlights({ topMain, topCommunity, recent, newLevels })
        }
      })
      .catch(err => console.error('Failed to load highlights:', err))
      .finally(() => { if (mounted) setHlLoading(false) })
    return () => { mounted = false }
  }, [])

  const hasHighlights = useMemo(() =>
    highlights.topMain.length > 0 || highlights.recent.length > 0 || highlights.newLevels.length > 0,
  [highlights])

  return (
    <div className={styles.page}>
      <div className={styles.heroBg} />

      <section className={styles.hero}>
        <motion.div
          className={styles.heroContent}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className={styles.heroBadge}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Shield size={14} />
            <span>Geometry Dash Community</span>
          </motion.div>

          <h1 className={styles.heroTitle}>
            <span className={styles.gradientText}>Basement List</span>
          </h1>

          <p className={styles.heroSubtitle}>
            The demon list for the tnaillzxgd Discord community — track completions, compete on leaderboards, and showcase your achievements.
          </p>

          <motion.div
            className={styles.heroActions}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Link to="/list/main">
              <Button variant="primary" size="lg" icon={List}>
                View Lists
              </Button>
            </Link>
            <Link to="/leaderboard/main">
              <Button variant="secondary" size="lg" icon={Trophy}>
                Rankings
              </Button>
            </Link>
          </motion.div>

          <motion.div
            className={styles.socialRow}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <a href="https://discord.gg/75FaX3gmM2" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" icon={Users}>Discord</Button>
            </a>
            <a href="https://www.tiktok.com/@tnaillzgd" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" icon={Music}>TikTok</Button>
            </a>
            <a href="https://www.youtube.com/@tNaiLLzxGd" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" icon={Youtube}>YouTube</Button>
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          className={styles.heroVisual}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className={styles.glowOrb} />
          <div className={styles.glowOrbSecondary} />
        </motion.div>
      </section>

      <section className={styles.featuresSection}>
        <motion.h2
          className={styles.sectionTitle}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Everything you need
        </motion.h2>
        <motion.p
          className={styles.sectionSubtitle}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          viewport={{ once: true }}
        >
          Track completions, compete on leaderboards, and grow with the community.
        </motion.p>
        <div className={styles.featuresGrid}>
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <Link to={feature.link} className={styles.featureLink}>
                <Card hover>
                  <div className={styles.featureCardTop} style={{ background: feature.color }}>
                    <feature.icon size={24} />
                  </div>
                  <div className={styles.featureBody}>
                    <h3 className={styles.featureTitle}>{feature.title}</h3>
                    <p className={styles.featureDesc}>{feature.desc}</p>
                    <span className={styles.featureArrow}>
                      Explore <ArrowRight size={14} />
                    </span>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {!hlLoading && hasHighlights && (
        <section className={styles.highlightsSection}>
          <motion.h2
            className={styles.sectionTitle}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Community Highlights
          </motion.h2>
          <motion.p
            className={styles.sectionSubtitle}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
          >
            Latest victories and brand-new community levels.
          </motion.p>

          <div className={styles.highlightsGrid}>
            {highlights.topMain.length > 0 && (
              <motion.div
                className={styles.highlightCardWrap}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Link to="/leaderboard/main" className={styles.highlightLink}>
                  <Card hover className={styles.highlightCard}>
                    <h3 className={styles.highlightTitle}>Top Players</h3>
                    <div className={styles.topPlayers}>
                      {highlights.topMain.map((p, i) => (
                        <Link to={`/profile/${p.id}`} className={styles.topPlayer} key={p.id}>
                          <span className={styles.topRank}>{i === 0 ? <Crown size={16} style={{ color: 'var(--accent-gold)' }} /> : `#${i + 1}`}</span>
                          <Avatar src={p.avatarURL} alt={getDisplayName(p)} size="sm" />
                          <span className={styles.topName}>{getDisplayName(p)}</span>
                          {getFlagUrl(p.country) && (
                            <img src={getFlagUrl(p.country)} alt={p.country} className={styles.flagImg} loading="lazy" />
                          )}
                          <span className={styles.topPoints}>{formatNumber(p.stats?.mainPoints || 0)}</span>
                        </Link>
                      ))}
                    </div>
                  </Card>
                </Link>
              </motion.div>
            )}

            {highlights.recent.length > 0 && (
              <motion.div
                className={styles.highlightCardWrap}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Link to="/list/main" className={styles.highlightLink}>
                  <Card hover className={styles.highlightCard}>
                    <h3 className={styles.highlightTitle}>Latest Victories</h3>
                    <div className={styles.recentList}>
                      {highlights.recent.map((c, i) => (
                        <div className={styles.recentRow} key={c.id || i}>
                          <Flame size={14} style={{ color: 'var(--accent-pink)', flexShrink: 0 }} />
                          <span className={styles.recentName}>
                            <strong>{c.username}</strong> beat <em>{c.levelName || 'Unknown Level'}</em>
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Link>
              </motion.div>
            )}

            {highlights.newLevels.length > 0 && (
              <motion.div
                className={styles.highlightCardWrap}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Link to="/list/community" className={styles.highlightLink}>
                  <Card hover className={styles.highlightCard}>
                    <h3 className={styles.highlightTitle}>New Community Levels</h3>
                    <div className={styles.newLevelsList}>
                      {highlights.newLevels.map((l, i) => (
                        <Link to={`/levels/${l.id}`} className={styles.newLevelRow} key={l.id}>
                          <span className={styles.newLevelName}>{l.name}</span>
                          <span className={styles.newLevelCreator}>by {l.creator}</span>
                          <span className={styles.newLevelArrow}>→</span>
                        </Link>
                      ))}
                    </div>
                  </Card>
                </Link>
              </motion.div>
            )}
          </div>
        </section>
      )}

      <section className={styles.ctaSection}>
        <motion.div
          className={styles.ctaContent}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className={styles.ctaTitle}>Ready to start?</h2>
          <p className={styles.ctaDesc}>
            Join the tnaillzxgd community, submit your completions, and climb the ranks.
          </p>
          <Link to="/register">
            <Button variant="primary" size="lg" icon={Users}>
              Get Started
            </Button>
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
