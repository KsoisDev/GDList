import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { getIdToken } from 'firebase/auth'
import { auth, db } from './firebase'

const READ_TIMEOUT_MS = 10000
const ASSIGNABLE_ROLES = new Set(['user', 'admin', 'owner'])

function withReadTimeout(promise, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took too long. Check your connection and try again.`)), READ_TIMEOUT_MS)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function ensureFreshToken() {
  const user = auth?.currentUser
  if (user) {
    try { await getIdToken(user, true) } catch {}
  }
}

function isPermissionError(error) {
  const msg = error?.message || ''
  return error?.code === 'permission-denied'
    || msg.includes('insufficient permissions')
    || msg.includes('Missing or insufficient')
}

async function withRetry(fn) {
  try {
    return await fn()
  } catch (error) {
    if (isPermissionError(error)) {
      await ensureFreshToken()
      return await fn()
    }
    throw error
  }
}

export async function getDocument(collectionName, id) {
  return withRetry(async () => {
    const snap = await withReadTimeout(
      getDoc(doc(db, collectionName, id)),
      `Loading ${collectionName}`,
    )
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  })
}

export async function getCollection(collectionName, constraints = []) {
  return withRetry(async () => {
    const q = constraints.length > 0
      ? query(collection(db, collectionName), ...constraints)
      : collection(db, collectionName)
    const snap = await withReadTimeout(getDocs(q), `Loading ${collectionName}`)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  })
}

export async function createDocument(collectionName, id, data) {
  return withRetry(async () => {
    if (id) {
      const ref = doc(db, collectionName, id)
      await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      return id
    }
    const ref = await addDoc(collection(db, collectionName), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    return ref.id
  })
}

export async function updateDocument(collectionName, id, data) {
  return withRetry(async () => {
    const ref = doc(db, collectionName, id)
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
    return id
  })
}

export async function updateUserRole(userId, nextRole) {
  if (!ASSIGNABLE_ROLES.has(nextRole)) {
    throw new Error('That account role is not supported.')
  }

  await updateDocument('users', userId, { role: nextRole })
  return userId
}

export async function updateUserDeveloperFlag(userId, isDeveloper, displayName = '') {
  const batch = writeBatch(db)
  const now = serverTimestamp()
  batch.update(doc(db, 'users', userId), { isDeveloper: Boolean(isDeveloper), updatedAt: now })

  const staffRef = doc(db, 'staff', userId)
  if (isDeveloper) {
    batch.set(staffRef, {
      userId,
      title: 'List Developer',
      displayName,
      updatedAt: now,
    }, { merge: true })
  } else {
    batch.delete(staffRef)
  }

  await batch.commit()
  return userId
}

export async function deleteDocument(collectionName, id) {
  return withRetry(async () => {
    await deleteDoc(doc(db, collectionName, id))
  })
}

export async function queryCollection(collectionName, field, op, value, orderField = null, direction = 'asc', limitCount = null) {
  let constraints = [where(field, op, value)]
  if (orderField) constraints.push(orderBy(orderField, direction))
  if (limitCount) constraints.push(limit(limitCount))
  return getCollection(collectionName, constraints)
}

export { collection, doc, query, where, orderBy, limit, serverTimestamp, writeBatch }
