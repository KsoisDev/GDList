import { useCallback, useEffect, useRef, useState } from 'react'

export function useShareProfile(displayName, profilePath) {
  const [shareStatus, setShareStatus] = useState('')
  const clearTimerRef = useRef(null)

  useEffect(() => () => {
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current)
  }, [])

  const showStatus = useCallback((message) => {
    setShareStatus(message)
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current)
    clearTimerRef.current = window.setTimeout(() => setShareStatus(''), 2500)
  }, [])

  const shareProfile = useCallback(async () => {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
    const url = `${window.location.origin}${basePath}${profilePath}`
    const shareData = {
      title: `${displayName || 'Player'} · Basement List`,
      text: `View ${displayName || 'this player'} on the Basement List.`,
      url,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        showStatus('Profile shared')
        return
      }
      await navigator.clipboard.writeText(url)
      showStatus('Link copied')
    } catch (error) {
      if (error?.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        showStatus('Link copied')
      } catch {
        showStatus('Could not copy link')
      }
    }
  }, [displayName, profilePath, showStatus])

  return { shareProfile, shareStatus }
}
