import styles from './StartupError.module.css'

export default function StartupError({ message }) {
  return (
    <main className={styles.page}>
      <section className={styles.card} role="alert">
        <span className={styles.kicker}>Setup required</span>
        <h1>Basement List is not configured yet</h1>
        <p>
          Add the Firebase web app values from <code>.env.example</code> to the
          deployment environment, then rebuild the site.
        </p>
        <details>
          <summary>Configuration details</summary>
          <code>{message}</code>
        </details>
      </section>
    </main>
  )
}
