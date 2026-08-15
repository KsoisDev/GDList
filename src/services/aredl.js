const AREDL_DATA_URL = import.meta.env.VITE_AREDL_DATA_URL || '/aredl-levels.json'

let cachePromise = null

async function ensureLevels() {
  if (!cachePromise) {
    cachePromise = (async () => {
      const res = await fetch(AREDL_DATA_URL, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`AREDL data error: ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data.levels)) throw new Error('Unexpected AREDL data shape')
      return data.levels
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
    points: Math.max(1, 1001 - (level.position || 0)),
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