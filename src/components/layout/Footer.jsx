import { Link } from 'react-router-dom'
import { Github } from 'lucide-react'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>
            <span className={styles.logoText}>WebList</span>
            <span className={styles.logoAccent}>GD</span>
          </Link>
          <p className={styles.description}>
            Geometry Dash community demon list & leaderboards.
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
            <a href="#" className={styles.link}>Discord</a>
            <a href="#" className={styles.link}>
              <Github size={14} /> GitHub
            </a>
          </div>
        </div>
      </div>
      <div className={styles.bottom}>
        <p className={styles.copyright}>
          &copy; {new Date().getFullYear()} WebList. Not affiliated with RobTop Games.
        </p>
      </div>
    </footer>
  )
}
