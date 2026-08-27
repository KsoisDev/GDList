import { createContext, useState, useEffect, useCallback, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { getDocument } from '../services/firestore'
import { createUserDoc, getRegistrationBootstrapPromise } from '../services/auth'

export const AuthContext = createContext(null)
const AUTH_INIT_TIMEOUT_MS = 8000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const [listenerRevision, setListenerRevision] = useState(0)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(false)
  const listenerFailedRef = useRef(false)
  const userId = user?.uid
  const hasUserData = Boolean(userData)

  const readUserData = useCallback(async (firebaseUser) => {
    const bootstrap = getRegistrationBootstrapPromise()
    if (bootstrap) {
      try { await bootstrap } catch {}
    }

    let data = await getDocument('users', firebaseUser.uid)
    if (!data) {
      await createUserDoc(firebaseUser)
      data = await getDocument('users', firebaseUser.uid)
    }
    if (!data) {
      throw new Error('Your account profile could not be loaded.')
    }
    return data
  }, [])

  const loadCurrentUserData = useCallback(async ({ showLoading = false } = {}) => {
    if (!mountedRef.current) return null

    const firebaseUser = auth.currentUser
    const requestId = ++requestIdRef.current

    if (!firebaseUser) {
      if (mountedRef.current) {
        setUserData(null)
        setProfileError(null)
        if (showLoading) setLoading(false)
      }
      return null
    }

    const isCurrentRequest = () => (
      mountedRef.current
      && requestIdRef.current === requestId
      && auth.currentUser?.uid === firebaseUser.uid
    )

    setProfileError(null)
    if (showLoading) setLoading(true)

    try {
      const data = await readUserData(firebaseUser)
      if (!isCurrentRequest()) return null
      setUserData(data)
      return data
    } catch (error) {
      if (!isCurrentRequest()) return null
      const normalizedError = error instanceof Error
        ? error
        : new Error('Your account profile could not be loaded.')
      console.error('Failed to load user profile:', normalizedError)
      setUserData(null)
      setProfileError(normalizedError)
      throw normalizedError
    } finally {
      if (showLoading && isCurrentRequest()) setLoading(false)
    }
  }, [readUserData])

  useEffect(() => {
    mountedRef.current = true
    let initialAuthSettled = false
    const settleInitialAuth = () => {
      initialAuthSettled = true
      clearTimeout(initialAuthTimeout)
    }
    const initialAuthTimeout = setTimeout(() => {
      if (!mountedRef.current || initialAuthSettled) return
      // Firebase can leave the first observer callback waiting indefinitely
      // when the network or project configuration is unavailable. Public and
      // sign-in routes should remain usable while a later callback can still
      // restore a cached session.
      setLoading(false)
    }, AUTH_INIT_TIMEOUT_MS)

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      settleInitialAuth()
      listenerFailedRef.current = false
      ++requestIdRef.current
      setUser(firebaseUser)
      setUserData(null)
      setProfileError(null)

      if (!firebaseUser) {
        setLoading(false)
        return
      }

      // The request id and current-user checks inside this helper prevent an
      // older profile request from winning after logout or an account switch.
      loadCurrentUserData({ showLoading: true }).catch(() => {})
    }, (error) => {
      settleInitialAuth()
      listenerFailedRef.current = true
      ++requestIdRef.current
      if (!mountedRef.current) return
      const normalizedError = error instanceof Error
        ? error
        : new Error('Authentication could not be initialized.')
      console.error('Authentication listener failed:', normalizedError)
      setUser(null)
      setUserData(null)
      setProfileError(normalizedError)
      setLoading(false)
    })

    return () => {
      mountedRef.current = false
      ++requestIdRef.current
      clearTimeout(initialAuthTimeout)
      unsubscribe()
    }
  }, [loadCurrentUserData, listenerRevision])

  // Keep access-sensitive profile fields such as role and banned in sync for
  // active sessions. Firestore rules remain the real authorization boundary.
  useEffect(() => {
    if (!userId || !hasUserData) return undefined

    return onSnapshot(doc(db, 'users', userId), (snapshot) => {
      if (!mountedRef.current || auth.currentUser?.uid !== userId) return
      if (!snapshot.exists()) {
        setUserData(null)
        setProfileError(new Error('Your account profile is no longer available.'))
        return
      }
      setUserData({ id: snapshot.id, ...snapshot.data() })
      setProfileError(null)
    }, (error) => {
      if (!mountedRef.current || auth.currentUser?.uid !== userId) return
      console.error('User profile listener failed:', error)
      setProfileError(error instanceof Error ? error : new Error('Your account profile could not be updated.'))
    })
  }, [userId, hasUserData])

  const refreshUserData = useCallback(
    () => loadCurrentUserData({ showLoading: false }),
    [loadCurrentUserData],
  )

  const retryProfile = useCallback(() => {
    if (listenerFailedRef.current) {
      setProfileError(null)
      setLoading(true)
      setListenerRevision(revision => revision + 1)
      return Promise.resolve(null)
    }
    return loadCurrentUserData({ showLoading: true })
  }, [loadCurrentUserData])

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      profileError,
      refreshUserData,
      retryProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
