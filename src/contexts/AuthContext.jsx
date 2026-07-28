import { createContext, useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase'
import { getDocument } from '../services/firestore'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const data = await getDocument('users', firebaseUser.uid)
        setUserData(data)
      } else {
        setUserData(null)
      }
      setLoading(false)
    })
    return unsubscribe
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
