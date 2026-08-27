import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { MotionConfig, useReducedMotion } from 'framer-motion'

export const MotionEffectsContext = createContext(null)

const STORAGE_KEY = 'basement-motion-effects:v1'

function getInitialPreference() {
  if (typeof window === 'undefined') return true

  try {
    const savedPreference = window.localStorage.getItem(STORAGE_KEY)
    if (savedPreference === 'on') return true
    if (savedPreference === 'off') return false
  } catch {
    // Local storage can be unavailable in private or restricted browsing modes.
  }

  return true
}

export function MotionEffectsProvider({ children }) {
  const systemPrefersReducedMotion = useReducedMotion()
  const [preferenceEnabled, setPreferenceEnabled] = useState(getInitialPreference)
  const animationsEnabled = preferenceEnabled && !systemPrefersReducedMotion

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, preferenceEnabled ? 'on' : 'off')
    } catch {
      // The in-memory preference still works when storage is blocked.
    }

    document.documentElement.dataset.motion = preferenceEnabled ? 'on' : 'off'

    return () => {
      delete document.documentElement.dataset.motion
    }
  }, [preferenceEnabled])

  const toggleAnimations = useCallback(() => {
    setPreferenceEnabled(current => !current)
  }, [])

  const value = useMemo(() => ({
    animationsEnabled,
    preferenceEnabled,
    systemPrefersReducedMotion: Boolean(systemPrefersReducedMotion),
    setAnimationsEnabled: setPreferenceEnabled,
    toggleAnimations,
  }), [animationsEnabled, preferenceEnabled, systemPrefersReducedMotion, toggleAnimations])

  return (
    <MotionEffectsContext.Provider value={value}>
      <MotionConfig reducedMotion={preferenceEnabled ? 'user' : 'always'}>
        {children}
      </MotionConfig>
    </MotionEffectsContext.Provider>
  )
}
