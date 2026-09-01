import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { LANGUAGES, TRANSLATIONS } from '../i18n/translations'

export const LanguageContext = createContext(null)

const STORAGE_KEY = 'basement-list-language-v2'
const SUPPORTED = new Set(LANGUAGES.map(language => language.code))

function storedLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return SUPPORTED.has(stored) ? stored : 'en'
}

function readPath(object, path) {
  return path.split('.').reduce((value, part) => value?.[part], object)
}

function interpolate(value, values) {
  return String(value).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`)
}

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(storedLanguage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback(nextLocale => {
    if (SUPPORTED.has(nextLocale)) setLocaleState(nextLocale)
  }, [])

  const t = useCallback((key, values = {}) => {
    const translated = readPath(TRANSLATIONS[locale], key)
    const fallback = readPath(TRANSLATIONS.en, key)
    return interpolate(translated ?? fallback ?? key, values)
  }, [locale])

  const value = useMemo(
    () => ({ locale, setLocale, t, languages: LANGUAGES }),
    [locale, setLocale, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
