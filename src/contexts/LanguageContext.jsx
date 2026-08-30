import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { LANGUAGES, TRANSLATIONS } from '../i18n/translations'

export const LanguageContext = createContext(null)

const STORAGE_KEY = 'basement-list-language-v1'
const SUPPORTED = new Set(LANGUAGES.map(language => language.code))

function browserLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (SUPPORTED.has(stored)) return stored

  const preferred = navigator.languages || [navigator.language]
  for (const locale of preferred) {
    if (SUPPORTED.has(locale)) return locale
    const base = locale?.split('-')[0]
    if (SUPPORTED.has(base)) return base
    if (base === 'zh') return 'zh-CN'
  }
  return 'en'
}

function readPath(object, path) {
  return path.split('.').reduce((value, part) => value?.[part], object)
}

function interpolate(value, values) {
  return String(value).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`)
}

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(browserLanguage)

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

  const value = useMemo(() => ({ locale, setLocale, t, languages: LANGUAGES }), [locale, setLocale, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

