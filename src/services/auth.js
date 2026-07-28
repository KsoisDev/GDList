import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { auth } from './firebase'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export async function createUserDoc(user) {
  const userRef = doc(db, 'users', user.uid)
  const snap = await getDoc(userRef)
  if (!snap.exists()) {
    await setDoc(userRef, {
      username: user.displayName || user.email.split('@')[0],
      displayName: user.displayName || user.email.split('@')[0],
      email: user.email,
      avatarURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=111128&color=00ff88&bold=true`,
      role: 'user',
      stats: {
        totalPoints: 0,
        mainPoints: 0,
        communityPoints: 0,
        mainCompletions: 0,
        communityCompletions: 0,
        rank: 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
}

export async function registerWithEmail(email, password, username) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName: username })
  await setDoc(doc(db, 'users', cred.user.uid), {
    username,
    displayName: username,
    email,
    avatarURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=111128&color=00ff88&bold=true`,
    role: 'user',
    stats: {
      totalPoints: 0,
      mainPoints: 0,
      communityPoints: 0,
      mainCompletions: 0,
      communityCompletions: 0,
      rank: 0,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return cred.user
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider()
  await signInWithRedirect(auth, provider)
}

export async function handleGoogleRedirect() {
  const result = await getRedirectResult(auth)
  if (result?.user) {
    await createUserDoc(result.user)
  }
  return result?.user || null
}

export async function logout() {
  await signOut(auth)
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email)
}
