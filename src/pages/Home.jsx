import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Trophy, List, Users, Zap, Shield, Server } from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import styles from './Home.module.css'

const features = [
  {
    icon: List,
    title: 'Demon Lists',
    desc: 'Browse the official Global Demon List and our community-created demon list.',
    link: '/list/main',
    color: 'var(--accent-green)',
  },
  {
    icon: Trophy,
    title: 'Leaderboards',
    desc: 'Compete for the top spots on both main and community leaderboards.',
    link: '/leaderboard/main',
    color: 'var(--accent-gold)',
  },
  {
    icon: Zap,
    title: 'Submit Records',
    desc: 'Submit your completions and climb the ranks with verified records.',
    link: '/submit',
    color: 'var(--accent-blue)',
  },
  {
    icon: Users,
    title: 'Community',
    desc: 'Join our Discord server and be part of the growing GD community.',
    link: '#',
    color: 'var(--accent-purple)',
  },
]

const stats = [
  { value: '150+', label: 'Demons Listed', icon: Shield },
  { value: '500+', label: 'Active Players', icon: Users },
  { value: '1K+', label: 'Records Submitted', icon: Server },
  { value: 'Top 100', label: 'Global Rankings', icon: Trophy },
]

export default function Home() {
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
            Welcome to{' '}
            <span className={styles.gradientText}>WebList</span>
          </h1>

          <p className={styles.heroSubtitle}>
            The ultimate demon list and leaderboard platform for our Geometry Dash community.
            Track your progress, compete with others, and showcase your achievements.
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
            <a href="#">
              <Button variant="ghost" size="lg" icon={Users}>
                Join Discord
              </Button>
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

      <section className={styles.statsSection}>
        <div className={styles.statsGrid}>
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className={styles.statCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <stat.icon className={styles.statIcon} size={24} />
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <section className={styles.featuresSection}>
        <h2 className={styles.sectionTitle}>Everything you need</h2>
        <p className={styles.sectionSubtitle}>
          Track completions, compete on leaderboards, and connect with the community.
        </p>
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
                  <div className={styles.featureIcon} style={{ color: feature.color }}>
                    <feature.icon size={28} />
                  </div>
                  <h3 className={styles.featureTitle}>{feature.title}</h3>
                  <p className={styles.featureDesc}>{feature.desc}</p>
                  <span className={styles.featureArrow}>
                    Explore <ArrowRight size={14} />
                  </span>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
