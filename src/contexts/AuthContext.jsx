import { createContext, useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase'
import { getDocument } from '../services/firestore'
import { handleGoogleRedirect, createUserDoc } from '../services/auth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe
    async function init() {
      try { await handleGoogleRedirect() } catch (e) { console.error(e) }
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser)
        if (firebaseUser) {
          try {
            let data = await getDocument('users', firebaseUser.uid)
            if (!data) {
              await createUserDoc(firebaseUser)
              data = await getDocument('users', firebaseUser.uid)
            }
            setUserData(data)
          } catch (e) {
            console.error(e)
          }
        } else {
          setUserData(null)
        }
        setLoading(false)
      })
    }
    init()
    return () => { if (unsubscribe) unsubscribe() }
  }, [])

  const refreshUserData = async () => {
    if (user) {
      const data = await getDocument('users', user.uid)
      setUserData(data)
    }
  }

  return (
    <AuthContext.Provider value={{ user, userData, loading, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  )
}
