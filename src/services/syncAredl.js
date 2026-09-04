import { roundPoints } from '../utils/communityPoints'

const AREDL_API = 'https://api.aredl.net/v2/api'

export async function searchAredlUsers(query) {
  const res = await fetch(`${AREDL_API}/users?name_filter=${encodeURIComponent(query)}&per_page=10`)
  if (!res.ok) throw new Error('AREDL search failed')
  return res.json()
}

export async function fetchAredlProfile(id) {
  const res = await fetch(`${AREDL_API}/aredl/profile/${id}`)
  if (!res.ok) throw new Error('AREDL profile not found')
  return res.json()
}

export async function fetchAredlProfileByDiscordId(discordId) {
  const res = await fetch(`${AREDL_API}/aredl/profile/${discordId}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('AREDL lookup failed')
  return res.json()
}

export async function fetchAredlLevels() {
  const res = await fetch(`${AREDL_API}/aredl/levels?exclude_legacy=true`)
  if (!res.ok) throw new Error('AREDL levels fetch failed')
  return res.json()
}

// Normalize a GD level name so we can match between AREDL and our Firestore
// list. AREDL appends qualifiers like "(2P)", "(Solo)" and, for duplicate
// names, the creator's name between parentheses. We strip those trailing
// groups (plus any "REMAKE"/"OLD"-style clones) and collapse case/spaces.
function normalizeLevelName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchLevel(aredlRecord, mainLevelsById, mainLevelsByName) {
  const level = aredlRecord.level
  if (!level) return null

  // Prefer the in-game level id when the AREDL record carries it and our list
  // stores a matching gameId/levelId on the Firestore document.
  const gdId = String(level.level_id || '')
  if (gdId && mainLevelsById.has(gdId)) {
    return mainLevelsById.get(gdId)
  }

  // Fall back to a tolerant name match (strips "(2P)", creator suffixes, etc).
  const name = normalizeLevelName(level.name)
  if (name) {
    if (mainLevelsByName.has(name)) return mainLevelsByName.get(name)
    // Last resort: also try the raw lower-cased name as-is.
    const raw = String(level.name || '').toLowerCase()
    if (raw && mainLevelsByName.has(raw)) return mainLevelsByName.get(raw)
  }
  return null
}

export function computeSyncPlan(aredlProfile, mainLevels) {
  const mainLevelsById = new Map()
  const mainLevelsByName = new Map()
  for (const l of mainLevels) {
    if (l.gameId) mainLevelsById.set(String(l.gameId), l)
    if (l.levelId) mainLevelsById.set(String(l.levelId), l)
    if (l.name) mainLevelsByName.set(normalizeLevelName(l.name), l)
  }

  const records = aredlProfile.records || []
  const matched = []
  const unmatched = []

  for (const rec of records) {
    const level = matchLevel(rec, mainLevelsById, mainLevelsByName)
    if (level) {
      matched.push({ aredlRecord: rec, gdLevel: level })
    } else {
      unmatched.push(rec)
    }
  }

  return { matched, unmatched }
}

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'level'
}

function asName(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value.name === 'string') return value.name
  return ''
}

// Index the AREDL catalogue (same mapped data the admin auto-fill and the
// "Sync Main List from AREDL" button use, so points/position scale matches
// our list) for enriching levels missing from Firestore.
export function indexAredlMeta(metaList) {
  const byGameId = new Map()
  const bySlug = new Map()
  const byName = new Map()
  for (const m of metaList || []) {
    if (m?.gameId) byGameId.set(String(m.gameId), m)
    if (m?.levelId != null) byGameId.set(String(m.levelId), m)
    if (m?.id) bySlug.set(String(m.id), m)
    if (m?.name) {
      const key = normalizeLevelName(m.name)
      if (key && !byName.has(key)) byName.set(key, m)
    }
  }
  return { byGameId, bySlug, byName }
}

export function findAredlMeta(aredlRecord, index) {
  if (!index) return null
  const level = aredlRecord?.level || {}
  const gdId = String(level.level_id || '')
  if (gdId && index.byGameId.has(gdId)) return index.byGameId.get(gdId)
  const name = normalizeLevelName(level.name)
  if (name && index.byName.has(name)) return index.byName.get(name)
  return null
}

// Build a Firestore `levels` doc for an AREDL record with no match in our
// list. Points/position come from the AREDL catalogue; unknown creator or
// points fall back to placeholders and mark the doc for review.
const MAIN_LEVEL_ID_PREFIX = 'main_'

export function buildMissingLevelDoc(aredlRecord, meta) {
  const recordLevel = aredlRecord?.level || {}
  const name = meta?.name || recordLevel.name || 'Unknown'
  const slug = meta?.id || slugify(name)
  const gameId = String(meta?.gameId ?? meta?.levelId ?? recordLevel.level_id ?? '')
  const creator = asName(meta?.creators?.[0])
    || (Array.isArray(recordLevel.creators) ? asName(recordLevel.creators[0]) : '')
    || recordLevel.creator
    || 'Unknown'
  const verifier = asName(meta?.verifier) || recordLevel.verifier || 'Unknown'
  const position = Number(meta?.position ?? recordLevel.position) || 0
  const hasMetaPoints = meta?.points != null
  const points = hasMetaPoints ? roundPoints(meta.points) : 0
  const now = new Date()
  return {
    id: `${MAIN_LEVEL_ID_PREFIX}${slug}`,
    slug,
    gameId,
    data: {
      type: 'main',
      name,
      creator,
      verifier,
      difficulty: 'extreme',
      gameId,
      thumbnail: '',
      position,
      points,
      victoryCount: 0,
      victors: [],
      firstCompletedAt: now,
      isActive: true,
      percentage: 100,
      autoCreated: true,
      createdVia: 'aredl_sync',
      needsReview: !hasMetaPoints || creator === 'Unknown',
    },
  }
}

export async function applySync(userId, matched, existingCompletions, { addCompletion, updateLevelVictors }) {
  const existingLevelIds = new Set(existingCompletions.map(c => c.levelId))
  const toAdd = matched.filter(m => !existingLevelIds.has(m.gdLevel.id))

  let added = 0
  for (const { aredlRecord, gdLevel } of toAdd) {
    const completionId = `aredl_sync_${userId}_${gdLevel.id}`
    await addCompletion(completionId, {
      userId,
      levelId: gdLevel.id,
      levelType: 'main',
      levelName: gdLevel.name,
      points: gdLevel.points || 0,
      videoURL: aredlRecord.video_url || '',
      completedAt: new Date(),
      source: 'aredl_sync',
    })
    added++
    if (updateLevelVictors) {
      try {
        await updateLevelVictors(completionId, gdLevel, aredlRecord)
      } catch (err) {
        console.error('[aredl-sync] victor update failed:', err)
      }
    }
  }

  return { added, skipped: matched.length - added }
}
