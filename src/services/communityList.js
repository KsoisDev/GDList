import { getCollection, getDocument, doc, writeBatch, where } from './firestore'
import { db } from './firebase'
import { communityPoints, roundPoints } from '../utils/communityPoints'
import { logLevelChange } from './changelog'

const isVerified = l => (l.victoryCount || 0) > 0

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
  const batch = writeBatch(db)
  const ranked = includeAll ? all : all.filter(isVerified)
  ranked.forEach((level, i) => {
    const position = i + 1
    batch.update(doc(db, 'levels', level.id), { position, points: communityPoints(position) })
  })
  all.filter(l => !ranked.some(r => r.id === l.id)).forEach(l => {
    batch.update(doc(db, 'levels', l.id), { position: 0 })
  })
  await batch.commit()
  if (log) {
    await Promise.all(ranked.map((level, i) =>
      logLevelChange({ levelId: level.id, action: 'renumbered', from: level.position || null, to: i + 1 })
    ))
  }
  return ranked
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