const CACHE_KEY = 'basement-main-list:v1'
const SNAPSHOT_VERSION = 1

function validLevel(level) {
  return level
    && typeof level.id === 'string'
    && typeof level.name === 'string'
    && Number.isFinite(Number(level.position))
    && Number(level.victoryCount) > 0
}

function sanitizeLevels(levels) {
  if (!Array.isArray(levels)) return []
  return levels.filter(validLevel).map(level => ({
    id: level.id,
    name: level.name,
    position: Number(level.position),
    points: Number(level.points) || 0,
    creator: String(level.creator || 'Unknown'),
    difficulty: String(level.difficulty || 'Extreme Demon'),
    victoryCount: Number(level.victoryCount) || 0,
    victors: Array.isArray(level.victors)
      ? level.victors
        .filter(victor => victor && typeof victor.userId === 'string')
        .map(victor => ({ userId: victor.userId }))
      : [],
  }))
}

export function cacheMainLevels(levels) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: SNAPSHOT_VERSION,
      savedAt: new Date().toISOString(),
      levels: sanitizeLevels(levels),
    }))
  } catch {
    // Private browsing and strict storage settings can disable localStorage.
  }
}

function readCachedMainLevels() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (cached?.version !== SNAPSHOT_VERSION) return []
    return sanitizeLevels(cached.levels)
  } catch {
    return []
  }
}

async function readBundledMainLevels() {
  const response = await fetch(`${import.meta.env.BASE_URL}main-levels.json`, {
    cache: 'no-cache',
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`Fallback snapshot returned HTTP ${response.status}`)
  const snapshot = await response.json()
  if (snapshot?.version !== SNAPSHOT_VERSION) return []
  return sanitizeLevels(snapshot.levels)
}

export async function getMainLevelsFallback() {
  const cached = readCachedMainLevels()
  if (cached.length > 0) return cached
  return readBundledMainLevels()
}
