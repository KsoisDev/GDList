import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { LANGUAGES, TRANSLATIONS } from '../i18n/translations'

const STORAGE_KEY = 'basement-language:v1'
const supportedCodes = new Set(LANGUAGES.map(language => language.code))

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (supportedCodes.has(saved)) return saved
  } catch {
    // Storage can be disabled in private browsing.
  }
  const browserLanguage = navigator.language?.split('-')[0]?.toLowerCase()
  return supportedCodes.has(browserLanguage) ? browserLanguage : 'en'
}

function interpolate(message, values) {
  return Object.entries(values || {}).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    message,
  )
}

export const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage)

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState(supportedCodes.has(nextLanguage) ? nextLanguage : 'en')
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    try {
      localStorage.setItem(STORAGE_KEY, language)
    } catch {
      // The language still works for the current page when storage is blocked.
    }
  }, [language])

  const t = useCallback((key, values) => {
    const message = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key
    return interpolate(message, values)
  }, [language])

  const value = useMemo(() => ({ language, languages: LANGUAGES, setLanguage, t }), [language, setLanguage, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
