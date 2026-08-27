import styles from './GeometryRunner.module.css'

export default function GeometryRunner() {
  return (
    <div className={styles.stage} aria-hidden="true" data-testid="geometry-runner">
      <div className={styles.grid} />
      <div className={styles.ground} />
      <span className={`${styles.spike} ${styles.spikeOne}`} />
      <span className={`${styles.spike} ${styles.spikeTwo}`} />
      <span className={styles.portal} />
      <div className={styles.runner}>
        <span className={styles.trail} />
        <span className={styles.cube}>
          <span className={styles.face}>
            <i />
            <i />
          </span>
        </span>
      </div>
    </div>
  )
}
