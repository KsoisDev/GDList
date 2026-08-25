import { Languages } from 'lucide-react'
import { useLanguage } from '../../hooks/useLanguage'
import styles from './LanguageSelector.module.css'

export default function LanguageSelector() {
  const { language, languages, setLanguage, t } = useLanguage()

  return (
    <label className={styles.picker} title={t('language.choose')}>
      <Languages size={16} aria-hidden="true" />
      <span className={styles.srOnly}>{t('language.choose')}</span>
      <select
        value={language}
        onChange={event => setLanguage(event.target.value)}
        aria-label={t('language.choose')}
      >
        {languages.map(option => (
          <option value={option.code} key={option.code} title={option.label}>{option.shortLabel}</option>
        ))}
      </select>
    </label>
  )
}
