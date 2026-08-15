const AREDL_DATA_URL = import.meta.env.VITE_AREDL_DATA_URL || '/aredl-levels.json'
const AREDL_LIVE_URL = import.meta.env.VITE_AREDL_LIVE_URL || 'https://api.aredl.net/v2/api/aredl/levels?exclude_legacy=true'
const LIVE_MERGE_MS = 10000

let cachePromise = null

const slugify = name =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'level'

function mergeLive(localLevels, liveLevels) {
  const byLevelId = new Map()
  for (const l of localLevels) {
    if (l.levelId != null) byLevelId.set(String(l.levelId), l)
  }
  for (const live of liveLevels) {
    const base = byLevelId.get(String(live.level_id)) || localLevels.find(l => l.slug === slugify(live.name))
    if (base) {
      base.position = live.position
      if (live.points != null) base.points = live.points / 10
    }
  }
  return localLevels
}

async function refreshLive(baseLevels) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LIVE_MERGE_MS)
  try {
    const res = await fetch(AREDL_LIVE_URL, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    })
    if (!res.ok) return false
    const data = await res.json()
    if (!Array.isArray(data)) return false
    cachePromise = Promise.resolve(mergeLive(baseLevels, data))
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function ensureLevels() {
  if (!cachePromise) {
    cachePromise = (async () => {
      const res = await fetch(AREDL_DATA_URL, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`AREDL data error: ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data.levels)) throw new Error('Unexpected AREDL data shape')
      const levels = data.levels
      refreshLive(levels)
      return levels
    })().catch(err => {
      cachePromise = null
      throw err
    })
  }
  return cachePromise
}

export function mapAredlLevel(level) {
  const creator = level.creators?.[0] || 'Unknown'
  return {
    id: level.slug,
    name: level.name,
    position: level.position,
    points: level.points != null ? level.points : Math.max(1, 1001 - (level.position || 0)),
    gameId: level.levelId != null ? String(level.levelId) : '',
    levelId: level.levelId,
    twoPlayer: Boolean(level.twoPlayer),
    difficulty: 'Extreme Demon',
    publisher: { name: creator },
    creators: (level.creators || []).map(c => ({ name: c })),
    verifier: { name: level.verifier !== 'Unknown' ? level.verifier : '' },
    percentage: level.percentage || 100,
    dataSource: 'aredl',
  }
}

export async function fetchAredlLevels() {
  const levels = await ensureLevels()
  return levels.map(mapAredlLevel)
}

export async function lookupAredlLevel(id) {
  const levels = await ensureLevels()
  return levels.find(l => l.slug === id) || null
}