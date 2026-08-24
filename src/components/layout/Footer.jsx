import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>
            <span className={styles.logoText}>Basement List</span>
            <span className={styles.logoAccent}>GD</span>
          </Link>
          <p className={styles.description}>
            Geometry Dash demon list for the tnaillzxgd Discord community.
          </p>
        </div>
        <div className={styles.links}>
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Lists</h4>
            <Link to="/list/main" className={styles.link}>Main List</Link>
            <Link to="/list/community" className={styles.link}>Community List</Link>
          </div>
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Rankings</h4>
            <Link to="/leaderboard/main" className={styles.link}>Main Rankings</Link>
            <Link to="/leaderboard/community" className={styles.link}>Community Rankings</Link>
          </div>
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Community</h4>
            <a href="https://discord.gg/75FaX3gmM2" target="_blank" rel="noopener noreferrer" className={styles.link}>Discord</a>
            <a href="https://www.tiktok.com/@tnaillzgd" target="_blank" rel="noopener noreferrer" className={styles.link}>TikTok</a>
            <a href="https://www.youtube.com/@tNaiLLzxGd" target="_blank" rel="noopener noreferrer" className={styles.link}>YouTube</a>
          </div>
        </div>
      </div>
      <div className={styles.bottom}>
        <p className={styles.copyright}>
          &copy; {new Date().getFullYear()} Basement List. Not affiliated with RobTop Games.
        </p>
        <p className={styles.credit}>
          Created by{' '}
          <a href="https://github.com/ntyu2" target="_blank" rel="noopener noreferrer">
            ntyu2
          </a>
        </p>
      </div>
    </footer>
  )
}
