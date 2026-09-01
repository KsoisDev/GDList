import { Link } from 'react-router-dom'
import { Youtube, Music, Users, ArrowUpRight } from 'lucide-react'
import { useLanguage } from '../../hooks/useLanguage'
import styles from './Footer.module.css'

export default function Footer() {
  const { t } = useLanguage()
  return (
    <footer className={styles.footer}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>
            <span className={styles.logoText}>Basement List</span>
            <span className={styles.logoAccent}>GD</span>
          </Link>
          <p className={styles.description}>
            {t('footer.description')}
          </p>
          <div className={styles.socials}>
            <a href="https://discord.gg/75FaX3gmM2" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="Discord">
              <Users size={16} />
            </a>
            <a href="https://www.tiktok.com/@tnaillzgd" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="TikTok">
              <Music size={16} />
            </a>
            <a href="https://www.youtube.com/@tNaiLLzxGd" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="YouTube">
              <Youtube size={16} />
            </a>
          </div>
        </div>
        <div className={styles.links}>
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>{t('footer.lists')}</h4>
            <Link to="/list/main" className={styles.link}>
              {t('nav.mainList')} <ArrowUpRight size={13} />
            </Link>
            <Link to="/list/community" className={styles.link}>
              {t('nav.communityList')} <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>{t('footer.rankings')}</h4>
            <Link to="/leaderboard/main" className={styles.link}>
              {t('nav.mainRankings')} <ArrowUpRight size={13} />
            </Link>
            <Link to="/leaderboard/community" className={styles.link}>
              {t('nav.communityRankings')} <ArrowUpRight size={13} />
            </Link>
            <Link to="/leaderboard/countries" className={styles.link}>
              {t('nav.countryRankings')} <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>{t('footer.community')}</h4>
            <a href="https://discord.gg/75FaX3gmM2" target="_blank" rel="noopener noreferrer" className={styles.link}>
              Discord <ArrowUpRight size={13} />
            </a>
            <a href="https://www.tiktok.com/@tnaillzgd" target="_blank" rel="noopener noreferrer" className={styles.link}>
              TikTok <ArrowUpRight size={13} />
            </a>
            <a href="https://www.youtube.com/@tNaiLLzxGd" target="_blank" rel="noopener noreferrer" className={styles.link}>
              YouTube <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </div>
      <div className={styles.bottom}>
        <p className={styles.copyright}>
          &copy; {new Date().getFullYear()} ntyu2 and Ksois. {t('footer.rights')}
        </p>
        <p className={styles.credit}>
          {t('footer.createdBy')}{' '}
          <a href="https://github.com/ntyu2" target="_blank" rel="noopener noreferrer">
            ntyu2
          </a>
          {` ${t('footer.and')} `}
          <a href="https://github.com/KsoisDev" target="_blank" rel="noopener noreferrer">
            Ksois
          </a>
        </p>
      </div>
    </footer>
  )
}
