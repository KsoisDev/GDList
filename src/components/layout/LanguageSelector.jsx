import { Languages } from 'lucide-react'
import { useLanguage } from '../../hooks/useLanguage'
import styles from './LanguageSelector.module.css'

export default function LanguageSelector({ compact = false }) {
  const { locale, setLocale, t, languages } = useLanguage()

  return (
    <label className={`${styles.selector} ${compact ? styles.compact : ''}`}>
      <Languages size={16} aria-hidden="true" />
      <span className={styles.srOnly}>{t('language.select')}</span>
      <select
        value={locale}
        onChange={event => setLocale(event.target.value)}
        aria-label={t('language.select')}
      >
        {languages.map(language => (
          <option value={language.code} key={language.code}>
            {compact ? language.short : language.label}
          </option>
        ))}
      </select>
    </label>
  )
}

