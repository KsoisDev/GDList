import { getCollection, writeBatch, doc, where } from './firestore'
import { db } from './firebase'
import { roundPoints } from '../utils/communityPoints'
import { fetchAredlLevels } from './aredl'

const normalizeName = name => String(name || '').trim().toLowerCase()

const BATCH_LIMIT = 400

export async function syncMainLevelsFromAredl() {
  const aredl = await fetchAredlLevels()
  const byName = new Map()
  const byGameId = new Map()
  aredl.forEach(l => {
    const key = normalizeName(l.name)
    if (key && !byName.has(key)) byName.set(key, l)
    if (l.gameId && !byGameId.has(String(l.gameId))) byGameId.set(String(l.gameId), l)
  })

  const levels = await getMainLevels()
  const updated = []
  const unmatched = []

  for (const level of levels) {
    let match = level.gameId ? byGameId.get(String(level.gameId)) : null
    if (!match) match = byName.get(normalizeName(level.name))
    if (!match) {
      unmatched.push({ id: level.id, name: level.name })
      continue
    }
    updated.push({
      id: level.id,
      name: level.name,
      position: match.position,
      points: match.points != null ? match.points : (level.points || 0),
    })
  }

  for (let i = 0; i < updated.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    updated.slice(i, i + BATCH_LIMIT).forEach(u => {
      batch.update(doc(db, 'levels', u.id), {
        position: u.position,
        points: roundPoints(u.points),
      })
    })
    await batch.commit()
  }

  return { total: levels.length, updated: updated.length, unmatched }
}


export async function getMainLevels() {
  const data = await getCollection('levels', [where('type', '==', 'main')])
  return data
}

export async function findMainLevelByName(name) {
  const target = normalizeName(name)
  if (!target) return null
  const levels = await getMainLevels()
  return levels.find(l => normalizeName(l.name) === target) || null
}

export async function getMainLevelDuplicates() {
  const levels = await getMainLevels()
  const groups = new Map()
  levels.forEach(l => {
    if ((l.victoryCount || 0) <= 0) return
    const key = normalizeName(l.name)
    if (!key) return
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(l)
  })
  return [...groups.values()].filter(g => g.length > 1)
}

function canonicalScore(l) {
  return (l.id.startsWith('main_') ? 2 : 0)
    + ((l.position || 0) > 0 ? 1 : 0)
    + ((l.points || 0) > 0 ? 1 : 0)
    + ((l.victoryCount || 0) > 0 ? 1 : 0)
}

export async function mergeMainLevelDuplicates() {
  const duplicates = await getMainLevelDuplicates()
  const results = []

  let aredlByName = null
  const lookupAredlPoints = async name => {
    if (!aredlByName) {
      try {
        const aredl = await fetchAredlLevels()
        aredlByName = new Map()
        aredl.forEach(l => {
          const key = normalizeName(l.name)
          if (key && !aredlByName.has(key)) aredlByName.set(key, l)
        })
      } catch {
        aredlByName = new Map()
      }
    }
    const hit = aredlByName.get(normalizeName(name))
    return hit?.points != null ? roundPoints(hit.points) : 0
  }

  for (const group of duplicates) {
    const sorted = [...group].sort((a, b) => canonicalScore(b) - canonicalScore(a))
    const canonical = sorted[0]
    const removals = sorted.slice(1)

    const victorMap = new Map()
    group.forEach(l => (l.victors || []).forEach(v => {
      if (v?.userId && !victorMap.has(v.userId)) victorMap.set(v.userId, v)
    }))
    const mergedVictors = [...victorMap.values()]

    const finalPosition = canonical.position || 0
    let finalPoints = roundPoints(canonical.points || 0)
    if (!(finalPoints > 0)) finalPoints = await lookupAredlPoints(canonical.name)

    const dates = group.map(l => l.firstCompletedAt?.toMillis?.() || 0).filter(Boolean)
    const firstCompletedAt = dates.length
      ? new Date(Math.min(...dates))
      : null

    const batch = writeBatch(db)
    batch.update(doc(db, 'levels', canonical.id), {
      name: canonical.name,
      creator: canonical.creator || 'Unknown',
      victoryCount: mergedVictors.length,
      victors: mergedVictors,
      position: finalPosition,
      points: finalPoints,
      ...(firstCompletedAt ? { firstCompletedAt } : {}),
    })

    for (const dup of removals) {
      const dupComps = await getCollection('completions')
      dupComps
        .filter(c => c.levelId === dup.id)
        .forEach(c => {
          batch.update(doc(db, 'completions', c.id), {
            levelId: canonical.id,
            levelName: canonical.name,
          })
        })
      batch.delete(doc(db, 'levels', dup.id))
    }

    await batch.commit()
    results.push({
      name: canonical.name,
      kept: canonical.id,
      removed: removals.map(d => d.id),
      victors: mergedVictors.length,
      position: finalPosition,
      points: finalPoints,
    })
  }
  return results
}