import { createContext, useState, useEffect, useCallback, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { getDocument } from '../services/firestore'
import { createUserDoc, getRegistrationBootstrapPromise } from '../services/auth'

export const AuthContext = createContext(null)
const AUTH_INIT_TIMEOUT_MS = 8000
const PROFILE_LOAD_TIMEOUT_MS = 10000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const [listenerRevision, setListenerRevision] = useState(0)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(false)
  const listenerFailedRef = useRef(false)
  const hadDataRef = useRef(false)
  const userId = user?.uid

  const readUserData = useCallback(async (firebaseUser) => {
    const bootstrap = getRegistrationBootstrapPromise()
    if (bootstrap) {
      try { await bootstrap } catch {}
    }

    let data = await getDocument('users', firebaseUser.uid)
    if (!data) {
      try {
        await createUserDoc(firebaseUser)
        data = await getDocument('users', firebaseUser.uid)
      } catch (err) {
        console.warn('createUserDoc fallback failed, waiting for snapshot:', err)
      }
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

    const safetyTimeout = setTimeout(() => {
      if (!isCurrentRequest()) return
      setLoading(false)
    }, PROFILE_LOAD_TIMEOUT_MS)

    try {
      const data = await readUserData(firebaseUser)
      clearTimeout(safetyTimeout)
      if (!isCurrentRequest()) return null
      if (data) {
        setUserData(data)
        hadDataRef.current = true
      }
      return data
    } catch (error) {
      clearTimeout(safetyTimeout)
      if (!isCurrentRequest()) return null
      console.error('Failed to load user profile:', error)
      if (hadDataRef.current) {
        setUserData(null)
        setProfileError(error instanceof Error
          ? error
          : new Error('Your account profile could not be loaded.'))
      }
      return null
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
      setLoading(false)
    }, AUTH_INIT_TIMEOUT_MS)

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      settleInitialAuth()
      listenerFailedRef.current = false
      ++requestIdRef.current
      setUser(firebaseUser)
      setUserData(null)
      setProfileError(null)
      hadDataRef.current = false

      if (!firebaseUser) {
        setLoading(false)
        return
      }

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

  useEffect(() => {
    if (!userId) return undefined

    return onSnapshot(doc(db, 'users', userId), (snapshot) => {
      if (!mountedRef.current || auth.currentUser?.uid !== userId) return

      if (snapshot.exists()) {
        hadDataRef.current = true
        setUserData({ id: snapshot.id, ...snapshot.data() })
        setProfileError(null)
        setLoading(false)
      } else if (hadDataRef.current) {
        setUserData(null)
        setProfileError(new Error('Your account profile is no longer available.'))
        setLoading(false)
      }
    }, (error) => {
      if (!mountedRef.current || auth.currentUser?.uid !== userId) return
      console.error('User profile listener failed:', error)
      setProfileError(error instanceof Error ? error : new Error('Your account profile could not be updated.'))
      setLoading(false)
    })
  }, [userId])

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
