import { createContext, useCallback, useMemo } from 'react'
import { TRANSLATIONS } from '../i18n/translations'

export const LanguageContext = createContext(null)

function readPath(object, path) {
  return path.split('.').reduce((value, part) => value?.[part], object)
}

function interpolate(value, values) {
  return String(value).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`)
}

export function LanguageProvider({ children }) {
  const locale = 'en'

  const t = useCallback((key, values = {}) => {
    const translated = readPath(TRANSLATIONS.en, key)
    return interpolate(translated ?? key, values)
  }, [])

  const value = useMemo(() => ({ locale, t }), [t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
