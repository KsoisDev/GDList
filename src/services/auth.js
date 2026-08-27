import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  getIdToken,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import { doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
let registrationBootstrapPromise = null

export function getRegistrationBootstrapPromise() {
  return registrationBootstrapPromise
}

function safeDisplayName(user, preferredName = '') {
  const emailName = user?.email?.split('@')[0]
  return preferredName.trim() || user?.displayName?.trim() || emailName || 'Player'
}

function safeUsername(value, userId) {
  const cleaned = String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 20)
  if (cleaned.length >= 3) return cleaned
  return `Player_${String(userId).slice(0, 6)}`
}

function actionSettings(path) {
  const configuredBase = import.meta.env.VITE_APP_URL?.replace(/\/$/, '')
  const appBasePath = import.meta.env.BASE_URL === '/'
    ? ''
    : import.meta.env.BASE_URL.replace(/\/$/, '')
  const browserBase = typeof window !== 'undefined'
    ? `${window.location.origin}${appBasePath}`
    : ''
  const base = configuredBase || browserBase
  const safePath = path.startsWith('/') ? path : `/${path}`
  return base ? { url: `${base}${safePath}`, handleCodeInApp: false } : undefined
}

export async function configureAuthPersistence(remember = true) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
}

export async function createUserDoc(user, overrides = {}) {
  if (!user?.uid) throw new Error('A valid authenticated user is required.')

  // onAuthStateChanged fires as soon as Firebase creates the Auth account. Let
  // the registration call reserve the chosen username before the context tries
  // to bootstrap a fallback profile for the same account.
  if (!overrides.username && !overrides.displayName && registrationBootstrapPromise) {
    await registrationBootstrapPromise
  }

  const userRef = doc(db, 'users', user.uid)
  const displayName = safeDisplayName(user, overrides.displayName || overrides.username || '')
  const requestedUsername = safeUsername(overrides.username || displayName, user.uid)
  const fallbackUsername = safeUsername(`${requestedUsername.slice(0, 13)}_${user.uid.slice(0, 6)}`, user.uid)
  const requestedRef = doc(db, 'usernames', requestedUsername.toLowerCase())
  const fallbackRef = doc(db, 'usernames', fallbackUsername.toLowerCase())

  const result = await runTransaction(db, async transaction => {
    // Keep every transaction read ahead of the first write and in a
    // predictable order so the same flow works across Firestore SDK versions.
    const userSnap = await transaction.get(userRef)
    const requestedSnap = await transaction.get(requestedRef)
    const fallbackSnap = await transaction.get(fallbackRef)

    if (userSnap.exists()) return { created: false, data: userSnap.data() }

    let username = requestedUsername
    let usernameRef = requestedRef
    if (requestedSnap.exists() && requestedSnap.data().uid !== user.uid) {
      if (overrides.username) {
        const error = new Error('That username is already taken.')
        error.code = 'auth/username-already-in-use'
        throw error
      }
      if (fallbackSnap.exists() && fallbackSnap.data().uid !== user.uid) {
        const error = new Error('A unique username could not be generated. Please try again.')
        error.code = 'auth/username-already-in-use'
        throw error
      }
      username = fallbackUsername
      usernameRef = fallbackRef
    }

    const profile = {
      username,
      usernameLower: username.toLowerCase(),
      displayName: overrides.displayName?.trim() || displayName,
      avatarURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=111b31&color=6ca8ff&bold=true`,
      role: 'user',
      banned: false,
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
    }

    transaction.set(usernameRef, {
      uid: user.uid,
      username,
      usernameLower: username.toLowerCase(),
      createdAt: serverTimestamp(),
    })
    transaction.set(userRef, profile)
    return { created: true, data: profile }
  })

  if (result.created) return

  if (overrides.username || overrides.displayName) {
    await setDoc(userRef, {
      username: result.data.username || requestedUsername,
      usernameLower: result.data.usernameLower || requestedUsername.toLowerCase(),
      displayName,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }
}

export async function registerWithEmail(email, password, username, remember = true) {
  await configureAuthPersistence(remember)
  let finishBootstrap
  const bootstrapPromise = new Promise(resolve => { finishBootstrap = resolve })
  registrationBootstrapPromise = bootstrapPromise

  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)

    try {
      await updateProfile(cred.user, { displayName: username.trim() })
      await createUserDoc(cred.user, { username: username.trim(), displayName: username.trim() })
    } catch (error) {
      if (error?.code === 'auth/username-already-in-use') {
        try { await deleteUser(cred.user) } catch { await signOut(auth).catch(() => {}) }
        throw error
      }
      // AuthContext can safely finish this idempotent profile bootstrap on reload.
      error.partialRegistration = true
      throw error
    }

    try {
      await sendEmailVerification(cred.user, actionSettings('/verify-email'))
    } catch (error) {
      // Registration remains valid if the mail provider is temporarily unavailable.
      console.warn('Verification email could not be sent:', error)
    }

    return cred.user
  } finally {
    finishBootstrap()
    if (registrationBootstrapPromise === bootstrapPromise) registrationBootstrapPromise = null
  }
}

export async function loginWithEmail(email, password, remember = true) {
  await configureAuthPersistence(remember)
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
  await createUserDoc(cred.user)
  return cred.user
}

export async function loginWithGoogle(remember = true) {
  await configureAuthPersistence(remember)
  const cred = await signInWithPopup(auth, googleProvider)
  await createUserDoc(cred.user)
  return cred.user
}

export async function logout() {
  await signOut(auth)
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email.trim(), actionSettings('/login'))
}

export async function resendVerificationEmail() {
  const user = auth.currentUser
  if (!user) throw new Error('You need to sign in first.')
  if (user.emailVerified) return true
  await sendEmailVerification(user, actionSettings('/verify-email'))
  return false
}

export async function refreshVerificationStatus() {
  const user = auth.currentUser
  if (!user) return false
  await reload(user)
  const verified = auth.currentUser?.emailVerified === true
  if (verified) await getIdToken(auth.currentUser, true)
  return verified
}

export function usesPasswordProvider(user = auth.currentUser) {
  return user?.providerData?.some(provider => provider.providerId === 'password') === true
}

export async function reauthenticateCurrentUser(password = '') {
  const user = auth.currentUser
  if (!user) throw new Error('You need to sign in again.')

  if (usesPasswordProvider(user)) {
    if (!user.email || !password) throw new Error('Enter your current password to continue.')
    const credential = EmailAuthProvider.credential(user.email, password)
    await reauthenticateWithCredential(user, credential)
    return
  }

  await reauthenticateWithPopup(user, googleProvider)
}

export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser
  if (!user || !usesPasswordProvider(user)) {
    throw new Error('Password changes are only available for email accounts.')
  }
  await reauthenticateCurrentUser(currentPassword)
  await updatePassword(user, newPassword)
}

export async function updateCurrentUserProfile(displayName, photoURL) {
  const user = auth.currentUser
  if (!user) throw new Error('You need to sign in first.')
  await updateProfile(user, {
    displayName: displayName.trim(),
    photoURL: photoURL.trim() || null,
  })
}

export function getAuthErrorMessage(error) {
  const messages = {
    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-action-code': 'This account link is invalid or has already been used. Request a new one.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-api-key': 'Sign-in is not configured correctly. Please contact the site administrator.',
    'auth/expired-action-code': 'This account link has expired. Request a new one.',
    'auth/missing-email': 'Enter your email address.',
    'auth/missing-password': 'Enter your password.',
    'auth/network-request-failed': 'A network error occurred. Check your connection and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact the site administrator.',
    'auth/popup-blocked': 'The sign-in popup was blocked. Allow popups and try again.',
    'auth/popup-closed-by-user': 'The sign-in window was closed before completion.',
    'auth/requires-recent-login': 'For security, sign in again before changing sensitive account details.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
    'auth/unauthorized-domain': 'This site is not authorized for sign-in. Please contact the site administrator.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'The email or password is incorrect.',
    'auth/username-already-in-use': 'That username is already taken. Choose another one.',
    'auth/weak-password': 'Use a password with at least 8 characters.',
    'auth/wrong-password': 'The current password is incorrect.',
  }

  if (messages[error?.code]) return messages[error.code]
  if (error?.partialRegistration) return 'Your account was created, but the profile setup did not finish. Sign in again to repair it.'
  if (error?.code?.startsWith?.('auth/')) return 'Authentication failed. Please try again.'
  return error?.message || 'Something went wrong. Please try again.'
}
