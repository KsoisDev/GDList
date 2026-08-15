import { createContext, useState, useEffect, useCallback } from 'react'
import { getDocument } from '../services/firestore'

export const SiteConfigContext = createContext(null)

const DEFAULTS = { maintenance: false, maintenanceMessage: '' }

export function SiteConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getDocument('settings', 'site')
      setConfig(data ? { ...DEFAULTS, ...data } : DEFAULTS)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <SiteConfigContext.Provider value={{ ...config, loading, refresh }}>
      {children}
    </SiteConfigContext.Provider>
  )
}
