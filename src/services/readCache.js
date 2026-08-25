import { getCollection, where } from './firestore'

const LIST_TTL_MS = 60 * 1000
const TAGS_TTL_MS = 5 * 60 * 1000
const USERS_TTL_MS = 30 * 1000

const entries = new Map()
const inflight = new Map()

export function getCached(key, loader, ttlMs = LIST_TTL_MS) {
  const hit = entries.get(key)
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data)
  if (inflight.has(key)) return inflight.get(key)
  const promise = (async () => {
    try {
      const data = await loader()
      entries.set(key, { data, expiresAt: Date.now() + ttlMs })
      return data
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, promise)
  return promise
}

export function invalidateCache(...keys) {
  if (keys.length === 0) {
    entries.clear()
    return
  }
  keys.forEach(k => entries.delete(k))
}

export function loadMainLevels() {
  return getCached('mainLevels', () => getCollection('levels', [where('type', '==', 'main')]), LIST_TTL_MS)
}

export function loadCommunityLevels() {
  return getCached('communityLevels', () => getCollection('levels', [where('type', '==', 'community')]), LIST_TTL_MS)
}

export function loadTags() {
  return getCached('tags', () => getCollection('tags'), TAGS_TTL_MS)
}

export function loadUsers() {
  return getCached('users', () => getCollection('users'), USERS_TTL_MS)
}
