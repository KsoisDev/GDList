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

function matchLevel(aredlRecord, mainLevelsById, mainLevelsByName) {
  const level = aredlRecord.level
  if (!level) return null
  const gdId = String(level.level_id || '')
  if (gdId && mainLevelsById.has(gdId)) {
    return mainLevelsById.get(gdId)
  }
  const name = (level.name || '').toLowerCase()
  if (name && mainLevelsByName.has(name)) {
    return mainLevelsByName.get(name)
  }
  return null
}

export function computeSyncPlan(aredlProfile, mainLevels) {
  const mainLevelsById = new Map()
  const mainLevelsByName = new Map()
  for (const l of mainLevels) {
    if (l.gameId) mainLevelsById.set(String(l.gameId), l)
    if (l.name) mainLevelsByName.set(l.name.toLowerCase(), l)
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
  }

  return { added, skipped: matched.length - added }
}
