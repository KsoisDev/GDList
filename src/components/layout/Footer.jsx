import { Link } from 'react-router-dom'
import styles from './Footer.module.css'
import { useLanguage } from '../../hooks/useLanguage'

export default function Footer() {
  const { t } = useLanguage()
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>
            <span className={styles.logoText}>Basement List</span>
            <span className={styles.logoAccent}>GD</span>
          </Link>
          <p className={styles.description}>
            {t('footer.description')}
          </p>
        </div>
        <div className={styles.links}>
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>{t('footer.lists')}</h4>
            <Link to="/list/main" className={styles.link}>{t('nav.mainList')}</Link>
            <Link to="/list/community" className={styles.link}>{t('nav.communityList')}</Link>
          </div>
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>{t('footer.rankings')}</h4>
            <Link to="/leaderboard/main" className={styles.link}>{t('nav.mainRankings')}</Link>
            <Link to="/leaderboard/community" className={styles.link}>{t('nav.communityRankings')}</Link>
          </div>
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>{t('footer.community')}</h4>
            <a href="https://discord.gg/75FaX3gmM2" target="_blank" rel="noopener noreferrer" className={styles.link}>Discord</a>
            <a href="https://www.tiktok.com/@tnaillzgd" target="_blank" rel="noopener noreferrer" className={styles.link}>TikTok</a>
            <a href="https://www.youtube.com/@tNaiLLzxGd" target="_blank" rel="noopener noreferrer" className={styles.link}>YouTube</a>
          </div>
        </div>
      </div>
      <div className={styles.bottom}>
        <p className={styles.copyright}>
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </p>
        <p className={styles.credit}>
          {t('footer.createdBy')}{' '}
          <a href="https://github.com/ntyu2" target="_blank" rel="noopener noreferrer">
            ntyu2
          </a>
          {' and '}
          <a href="https://github.com/KsoisDev" target="_blank" rel="noopener noreferrer">
            Ksois
          </a>
        </p>
      </div>
    </footer>
  )
}
