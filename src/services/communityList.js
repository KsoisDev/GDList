import { getCollection, getDocument, doc, writeBatch, where } from './firestore'
import { db } from './firebase'
import { communityPoints, roundPoints } from '../utils/communityPoints'
import { logLevelChange } from './changelog'

const isVerified = l => (l.victoryCount || 0) > 0
const BATCH_SIZE = 450

async function commitUpdates(updates) {
  for (let start = 0; start < updates.length; start += BATCH_SIZE) {
    const batch = writeBatch(db)
    updates.slice(start, start + BATCH_SIZE).forEach(({ ref, data, type = 'update' }) => {
      if (type === 'set') batch.set(ref, data)
      else if (type === 'delete') batch.delete(ref)
      else batch.update(ref, data)
    })
    await batch.commit()
  }
}

export async function getCommunityLevels() {
  const data = await getCollection('levels', [where('type', '==', 'community')])
  return data.sort((a, b) => {
    const av = isVerified(a) ? 0 : 1
    const bv = isVerified(b) ? 0 : 1
    if (av !== bv) return av - bv
    return (a.position || 0) - (b.position || 0)
  })
}

export async function renumberCommunityLevels(levels = null, includeAll = false, log = false) {
  const all = levels || (await getCommunityLevels())
  const ranked = includeAll ? all : all.filter(isVerified)
  const updates = ranked.map((level, i) => {
    const position = i + 1
    return {
      ref: doc(db, 'levels', level.id),
      data: { position, points: communityPoints(position), updatedAt: new Date() },
    }
  })
  all.filter(l => !ranked.some(r => r.id === l.id)).forEach(level => {
    updates.push({
      ref: doc(db, 'levels', level.id),
      data: { position: 0, points: 0, updatedAt: new Date() },
    })
  })
  await commitUpdates(updates)
  await recalculateCommunityScores()
  if (log) {
    await Promise.all(ranked.map((level, i) =>
      logLevelChange({ levelId: level.id, action: 'renumbered', from: level.position || null, to: i + 1 })
    ))
  }
  return ranked
}

/**
 * Keep ranked levels, completion snapshots, and user totals aligned after a
 * community list move/removal. This is intentionally centralized because
 * updating only a level document leaves every leaderboard total stale.
 */
export async function recalculateCommunityScores() {
  const [levels, completions, users] = await Promise.all([
    getCollection('levels', [where('type', '==', 'community')]),
    getCollection('completions', [where('levelType', '==', 'community')]),
    getCollection('users'),
  ])

  const ranked = levels
    .filter(isVerified)
    .sort((a, b) => (a.position || Number.MAX_SAFE_INTEGER) - (b.position || Number.MAX_SAFE_INTEGER))
  const pointsByLevel = Object.fromEntries(
    ranked.map((level, index) => [level.id, communityPoints(index + 1)]),
  )
  const totals = {}
  const counts = {}
  const updates = []
  const updatedAt = new Date()

  ranked.forEach((level, index) => {
    const position = index + 1
    const points = pointsByLevel[level.id]
    if (level.position !== position || level.points !== points) {
      updates.push({
        ref: doc(db, 'levels', level.id),
        data: { position, points, updatedAt },
      })
    }
  })

  levels.filter(level => !isVerified(level)).forEach(level => {
    if ((level.position || 0) !== 0 || (level.points || 0) !== 0) {
      updates.push({
        ref: doc(db, 'levels', level.id),
        data: { position: 0, points: 0, updatedAt },
      })
    }
  })

  completions.forEach(completion => {
    const points = pointsByLevel[completion.levelId] || 0
    if (points > 0) {
      totals[completion.userId] = (totals[completion.userId] || 0) + points
      counts[completion.userId] = (counts[completion.userId] || 0) + 1
    }
    if ((completion.points || 0) !== points) {
      updates.push({
        ref: doc(db, 'completions', completion.id),
        data: { points, updatedAt },
      })
    }
  })

  users.forEach(user => {
    const stats = user.stats || {}
    const communityTotal = roundPoints(totals[user.id] || 0)
    const completionCount = counts[user.id] || 0
    const totalPoints = roundPoints((stats.mainPoints || 0) + communityTotal)
    if (
      (stats.communityPoints || 0) !== communityTotal
      || (stats.communityCompletions || 0) !== completionCount
      || (stats.totalPoints || 0) !== totalPoints
    ) {
      updates.push({
        ref: doc(db, 'users', user.id),
        data: {
          stats: {
            ...stats,
            totalPoints,
            communityPoints: communityTotal,
            communityCompletions: completionCount,
          },
          updatedAt,
        },
      })
    }
  })

  await commitUpdates(updates)
  return { levels: ranked.length, completions: completions.length, users: users.length }
}

export async function insertCommunityLevel(id, data, targetPosition) {
  const list = await getCommunityLevels()
  const existingIdx = list.findIndex(l => l.id === id)
  if (existingIdx !== -1) {
    const pos = Math.max(1, Math.min(Number(targetPosition) || list.length, list.length))
    const reordered = [...list]
    const [moved] = reordered.splice(existingIdx, 1)
    reordered.splice(pos - 1, 0, moved)
    await renumberCommunityLevels(reordered)
    await logLevelChange({ levelId: id, action: 'moved', from: existingIdx + 1, to: pos })
    return id
  }
  const now = new Date()
  if (!isVerified(data)) {
    await writeBatch(db).set(doc(db, 'levels', id), { ...data, position: 0, createdAt: now }).commit()
    await logLevelChange({ levelId: id, action: 'added', to: 0 })
    return id
  }
  const verified = list.filter(isVerified)
  const pos = Math.max(1, Math.min(Number(targetPosition) || verified.length + 1, verified.length + 1))
  const batch = writeBatch(db)
  batch.set(doc(db, 'levels', id), { ...data, position: pos, points: communityPoints(pos), createdAt: now })
  verified
    .filter(l => (l.position || 0) >= pos)
    .forEach(l => {
      const p = (l.position || 0) + 1
      batch.update(doc(db, 'levels', l.id), { position: p, points: communityPoints(p) })
    })
  await batch.commit()
  await recalculateCommunityScores()
  await logLevelChange({ levelId: id, action: 'added', to: pos })
  return id
}

export async function deleteCommunityLevel(id) {
  const list = await getCommunityLevels()
  const level = list.find(l => l.id === id)
  const batch = writeBatch(db)
  batch.delete(doc(db, 'levels', id))
  if (level && isVerified(level)) {
    list
      .filter(l => l.id !== id && isVerified(l) && (l.position || 0) > (level.position || 0))
      .forEach(l => {
        const p = (l.position || 0) - 1
        batch.update(doc(db, 'levels', l.id), { position: p, points: communityPoints(p) })
      })
  }

  const comps = await getCollection('completions')
  const affected = {}
  const levelComps = comps.filter(c => c.levelId === id)
  levelComps.forEach(c => {
    batch.delete(doc(db, 'completions', c.id))
    affected[c.userId] = {
      points: (affected[c.userId]?.points || 0) + (c.points || 0),
      count: (affected[c.userId]?.count || 0) + 1,
    }
  })

  for (const [userId, { points, count }] of Object.entries(affected)) {
    const userDoc = await getDocument('users', userId)
    if (userDoc) {
      const stats = userDoc.stats || {}
      batch.update(doc(db, 'users', userId), {
        stats: {
          ...stats,
          totalPoints: roundPoints(Math.max(0, (stats.totalPoints || 0) - points)),
          communityPoints: roundPoints(Math.max(0, (stats.communityPoints || 0) - points)),
          communityCompletions: Math.max(0, (stats.communityCompletions || 0) - count),
        },
      })
    }
  }

  await batch.commit()
  await recalculateCommunityScores()
  if (level) {
    await logLevelChange({ levelId: id, action: 'removed', from: level.position || null })
  }
}

export async function moveCommunityLevel(id, direction) {
  const list = await getCommunityLevels()
  const verified = list.filter(isVerified)
  const idx = verified.findIndex(l => l.id === id)
  if (idx === -1) return
  const newIdx = idx + direction
  if (newIdx < 0 || newIdx >= verified.length) return
  const reordered = [...verified]
  const [moved] = reordered.splice(idx, 1)
  reordered.splice(newIdx, 0, moved)
  await renumberCommunityLevels(reordered)
  await logLevelChange({ levelId: id, action: 'moved', from: idx + 1, to: newIdx + 1 })
}

export async function setCommunityPosition(id, newPosition) {
  const list = await getCommunityLevels()
  let verified = list.filter(isVerified)
  const target = list.find(l => l.id === id)
  if (!target) return
  if (!verified.some(l => l.id === id)) verified = [...verified, target]
  const idx = verified.findIndex(l => l.id === id)
  const pos = Math.max(1, Math.min(Number(newPosition) || verified.length, verified.length))
  const reordered = [...verified]
  const [moved] = reordered.splice(idx, 1)
  reordered.splice(pos - 1, 0, moved)
  await renumberCommunityLevels(reordered, true)
  await logLevelChange({ levelId: id, action: 'moved', from: target.position ? Number(target.position) : idx + 1, to: pos })
}

export async function getCommunityPointsMap() {
  const list = await getCommunityLevels()
  const map = {}
  list.forEach(l => { if (isVerified(l)) map[l.id] = l.position })
  return map
}

export function computeUserCommunityPoints(completions, pointsMap) {
  const totals = {}
  const counts = {}
  completions.forEach(c => {
    if (c.levelType !== 'community') return
    const pos = pointsMap[c.levelId]
    if (!pos) return
    totals[c.userId] = (totals[c.userId] || 0) + communityPoints(pos)
    counts[c.userId] = (counts[c.userId] || 0) + 1
  })
  return {
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, roundPoints(v)])),
    counts,
  }
}
