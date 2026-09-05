import { getCollection, getDocument, createDocument, updateDocument, writeBatch, doc, where } from './firestore'
import { db } from './firebase'
import { communityPoints, roundPoints } from '../utils/communityPoints'
import { fetchAredlLevels } from './aredl'
import { invalidateCache } from './readCache'

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

  invalidateCache('mainLevels')
  return { total: levels.length, updated: updated.length, unmatched }
}


export async function getMainLevels() {
  const data = await getCollection('levels', [where('type', '==', 'main')])
  return data
}

const slugify = name => String(name || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 60) || 'level'

/**
 * Promote a community level to the main list (copy, the community doc stays).
 * Existing victors are carried over with main-list completions + main points,
 * and both docs are cross-linked via mainLevelId / communityLevelId.
 */
export async function promoteCommunityLevelToMain(communityId, { position, points }) {
  const community = await getDocument('levels', communityId)
  if (!community || community.type !== 'community') throw new Error('Community level not found')

  const mainPosition = Number(position) || 0
  const mainPoints = roundPoints(Number(points) || 0)
  const now = new Date()

  // Already linked? Reuse the existing main doc.
  if (community.mainLevelId) {
    const linked = await getDocument('levels', community.mainLevelId)
    if (linked) return { id: linked.id, created: false }
  }

  // Avoid duplicates: reuse an existing main doc with same gameId, then name.
  const mainLevels = await getMainLevels()
  let dupe = null
  if (community.gameId) {
    dupe = mainLevels.find(l => String(l.gameId) === String(community.gameId)) || null
  }
  if (!dupe && community.name) {
    const target = normalizeName(community.name)
    dupe = mainLevels.find(l => normalizeName(l.name) === target) || null
  }
  if (dupe) {
    await updateDocument('levels', communityId, { mainLevelId: dupe.id })
    await updateDocument('levels', dupe.id, { communityLevelId: communityId })
    invalidateCache('mainLevels')
    invalidateCache('communityLevels')
    return { id: dupe.id, created: false }
  }

  let mainId = `main_${slugify(community.name)}`
  const collision = await getDocument('levels', mainId)
  if (collision) {
    mainId = `main_${slugify(community.name)}_${String(community.gameId || Date.now())}`
  }

  // Mirror existing victors onto the main list with main points.
  const victors = []
  for (const v of (community.victors || [])) {
    if (!v?.userId) continue
    const completionId = `completion_promote_${mainId}_${v.userId}`
    const already = await getDocument('completions', completionId)
    if (!already) {
      await createDocument('completions', completionId, {
        userId: v.userId,
        levelId: mainId,
        levelType: 'main',
        levelName: community.name,
        promotedFrom: communityId,
        points: mainPoints,
        videoURL: v.videoURL || '',
        completedAt: v.completedAt || now,
      })
    }
    victors.push({
      userId: v.userId,
      username: v.username || v.displayName || 'Player',
      displayName: v.displayName || v.username || 'Player',
      country: v.country || '',
      avatarURL: v.avatarURL || '',
      completionId,
      completedAt: v.completedAt || now,
      videoURL: v.videoURL || '',
    })
    const userDoc = await getDocument('users', v.userId)
    if (userDoc) {
      const s = userDoc.stats || {}
      await updateDocument('users', v.userId, {
        stats: {
          ...s,
          totalPoints: roundPoints((s.totalPoints || 0) + mainPoints),
          mainPoints: roundPoints((s.mainPoints || 0) + mainPoints),
          mainCompletions: (s.mainCompletions || 0) + 1,
        },
      })
    }
  }

  await createDocument('levels', mainId, {
    type: 'main',
    name: community.name,
    creator: community.creator || 'Unknown',
    verifier: community.verifier || 'Unknown',
    difficulty: 'extreme',
    gameId: community.gameId || '',
    thumbnail: '',
    videoURL: community.videoURL || '',
    description: community.description || '',
    tags: community.tags || [],
    position: mainPosition,
    points: mainPoints,
    victoryCount: victors.length,
    victors,
    firstCompletedAt: now,
    isActive: true,
    percentage: 100,
    communityLevelId: communityId,
    autoCreated: true,
    createdVia: 'community_promote',
  })
  await updateDocument('levels', communityId, { mainLevelId: mainId })

  invalidateCache('mainLevels')
  invalidateCache('communityLevels')
  return { id: mainId, created: true, victors: victors.length }
}

/**
 * Mirror a fresh victor onto the linked counterpart doc (community <-> main)
 * with that list's own points. Single hop, skips if already a victor there.
 */
export async function mirrorCompletionToLinked({
  levelId, userId, username, displayName, country, avatarURL,
  videoURL, completedAt, submissionId,
}) {
  if (!levelId || !userId) return { mirrored: false }
  const level = await getDocument('levels', levelId)
  if (!level) return { mirrored: false }
  const linkedId = level.mainLevelId || level.communityLevelId
  if (!linkedId || linkedId === levelId) return { mirrored: false }
  const target = await getDocument('levels', linkedId)
  if (!target) return { mirrored: false }
  if ((target.victors || []).some(v => v?.userId === userId)) {
    return { mirrored: false, reason: 'already-victor' }
  }

  const now = completedAt || new Date()
  const targetPoints = target.type === 'community'
    ? communityPoints(Number(target.position) || 0)
    : roundPoints(Number(target.points) || 0)
  const completionId = `completion_mirror_${linkedId}_${userId}`
  const existingComp = await getDocument('completions', completionId)
  if (!existingComp) {
    await createDocument('completions', completionId, {
      userId,
      levelId: linkedId,
      levelType: target.type,
      levelName: target.name,
      ...(submissionId ? { submissionId } : {}),
      mirroredFrom: levelId,
      points: targetPoints,
      videoURL: videoURL || '',
      completedAt: now,
    })
  }
  await updateDocument('levels', linkedId, {
    victoryCount: (target.victoryCount || 0) + 1,
    victors: [...(target.victors || []), {
      userId,
      username: username || displayName || 'Player',
      displayName: displayName || username || 'Player',
      country: country || '',
      avatarURL: avatarURL || '',
      completionId,
      completedAt: now,
      videoURL: videoURL || '',
    }],
  })
  const userDoc = await getDocument('users', userId)
  if (userDoc) {
    const s = userDoc.stats || {}
    const pointsField = target.type === 'community' ? 'communityPoints' : 'mainPoints'
    const compsField = target.type === 'community' ? 'communityCompletions' : 'mainCompletions'
    await updateDocument('users', userId, {
      stats: {
        ...s,
        totalPoints: roundPoints((s.totalPoints || 0) + targetPoints),
        [pointsField]: roundPoints((s[pointsField] || 0) + targetPoints),
        [compsField]: (s[compsField] || 0) + 1,
      },
    })
  }
  invalidateCache(target.type === 'community' ? 'communityLevels' : 'mainLevels')
  return { mirrored: true, completionId }
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