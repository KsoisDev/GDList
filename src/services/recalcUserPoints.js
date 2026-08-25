import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from './firebase'
import { roundPoints } from '../utils/communityPoints'
import { invalidateCache } from './readCache'

const BATCH_LIMIT = 400

const toMillis = ts => ts?.toMillis?.() || 0

const norm2 = value => Number((Number(value) || 0).toFixed(2))

export async function recalcAllUsersPoints() {
  const [completionsSnap, levelsSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, 'completions')),
    getDocs(collection(db, 'levels')),
    getDocs(collection(db, 'users')),
  ])

  const levelsById = new Map()
  levelsSnap.forEach(d => levelsById.set(d.id, d.data()))

  // 1. Group completions by user+level; keep the earliest one
  const kept = new Map()
  const duplicates = []

  completionsSnap.forEach(d => {
    const c = d.data()
    if (!c.userId) return
    const key = `${c.userId}|${c.levelId || c.levelName || d.id}`
    const candidate = { id: d.id, ref: d.ref, data: c }
    const prev = kept.get(key)
    if (!prev) {
      kept.set(key, candidate)
      return
    }
    const prevTime = toMillis(prev.data.firstCompletedAt) || toMillis(prev.data.createdAt)
    const currTime = toMillis(c.firstCompletedAt) || toMillis(c.createdAt)
    if (currTime && (!prevTime || currTime < prevTime)) {
      duplicates.push(prev)
      kept.set(key, candidate)
    } else {
      duplicates.push(candidate)
    }
  })

  // 2. Refresh completion points from current level data and aggregate per user
  const refreshed = []
  const totals = new Map()

  for (const entry of kept.values()) {
    const c = entry.data
    const level = c.levelId ? levelsById.get(c.levelId) : null
    let points = norm2(c.points)
    if (level) {
      points = roundPoints(Number(level.points) || 0)
      if (points !== norm2(c.points)) {
        refreshed.push({ ref: entry.ref, points })
      }
    }
    const type = c.levelType === 'community' ? 'community' : 'main'
    const agg = totals.get(c.userId) || { main: 0, community: 0 }
    agg[type] += points
    totals.set(c.userId, agg)
  }

  // 3. Write batches: refreshed points, duplicate deletions, victor snapshots, user stats
  let batch = writeBatch(db)
  let ops = 0
  const commitQueue = []
  const pushOp = () => {
    ops += 1
    if (ops % BATCH_LIMIT === 0) {
      commitQueue.push(batch)
      batch = writeBatch(db)
    }
  }

  const usersById = new Map()
  usersSnap.forEach(d => {
    const u = d.data()
    usersById.set(d.id, {
      username: u.username || '',
      displayName: u.displayName || '',
      country: u.country || '',
      avatarURL: u.avatarURL || '',
    })
  })

  let snapshotsUpdated = 0
  for (const [levelId, level] of levelsById.entries()) {
    const victors = level.victors
    if (!Array.isArray(victors) || victors.length === 0) continue
    let changed = false
    const nextVictors = victors.map(v => {
      if (!v?.userId) return v
      const u = usersById.get(v.userId)
      if (!u) return v
      const nextUsername = u.username || v.username || ''
      const nextDisplayName = u.displayName || u.username || v.displayName || nextUsername
      const nextCountry = u.country || ''
      const nextAvatarURL = u.avatarURL || ''
      if (
        (v.username || '') !== nextUsername
        || (v.displayName || '') !== nextDisplayName
        || (v.country || '') !== nextCountry
        || (v.avatarURL || '') !== nextAvatarURL
      ) {
        changed = true
        return { ...v, username: nextUsername, displayName: nextDisplayName, country: nextCountry, avatarURL: nextAvatarURL }
      }
      return v
    })
    if (changed) {
      batch.update(doc(db, 'levels', levelId), { victors: nextVictors })
      snapshotsUpdated += 1
      pushOp()
    }
  }

  for (const r of refreshed) {
    batch.update(r.ref, { points: r.points })
    pushOp()
  }
  for (const dup of duplicates) {
    batch.delete(dup.ref)
    pushOp()
  }

  let usersUpdated = 0
  usersSnap.forEach(d => {
    const u = d.data()
    const agg = totals.get(d.id) || { main: 0, community: 0 }
    const stats = {
      mainPoints: roundPoints(agg.main),
      communityPoints: roundPoints(agg.community),
      totalPoints: roundPoints(agg.main + agg.community),
    }
    const old = u.stats || {}
    if (
      norm2(old.mainPoints) !== stats.mainPoints
      || norm2(old.communityPoints) !== stats.communityPoints
      || norm2(old.totalPoints) !== stats.totalPoints
    ) {
      batch.update(doc(db, 'users', d.id), { stats })
      usersUpdated += 1
      pushOp()
    }
  })
  commitQueue.push(batch)

  if (ops % BATCH_LIMIT > 0) {
    commitQueue.push(batch)
  }

  for (const b of commitQueue) {
    try {
      await b.commit()
    } catch (err) {
      console.error('recalcUserPoints batch error:', err)
      throw err
    }
  }

  invalidateCache('users')
  return {
    completionsTotal: completionsSnap.size,
    duplicatesRemoved: duplicates.length,
    completionsRefreshed: refreshed.length,
    usersChecked: usersSnap.size,
    usersUpdated,
    snapshotsUpdated,
  }
}
