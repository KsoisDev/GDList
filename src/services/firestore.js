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
import { db } from './firebase'

export async function getDocument(collectionName, id) {
  const snap = await getDoc(doc(db, collectionName, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getCollection(collectionName, constraints = []) {
  const q = constraints.length > 0
    ? query(collection(db, collectionName), ...constraints)
    : collection(db, collectionName)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function createDocument(collectionName, id, data) {
  if (id) {
    const ref = doc(db, collectionName, id)
    await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    return id
  }
  const ref = await addDoc(collection(db, collectionName), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

export async function updateDocument(collectionName, id, data) {
  const ref = doc(db, collectionName, id)
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
  return id
}

export async function deleteDocument(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id))
}

export async function queryCollection(collectionName, field, op, value, orderField = null, direction = 'asc', limitCount = null) {
  let constraints = [where(field, op, value)]
  if (orderField) constraints.push(orderBy(orderField, direction))
  if (limitCount) constraints.push(limit(limitCount))
  return getCollection(collectionName, constraints)
}

export { collection, doc, query, where, orderBy, limit, serverTimestamp, writeBatch }
