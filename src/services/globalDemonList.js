import { getYouTubeThumbnail } from '../utils/video'

const DATA_URL = `${import.meta.env.BASE_URL}gdl-levels.json`

let levelsPromise = null

const normalizeName = name => String(name || '').trim().toLowerCase()

function getLookupNames(name) {
  const exact = normalizeName(name)
  const withoutCreatorSuffix = exact.replace(/\s*\([^()]+\)\s*$/, '').trim()
  return withoutCreatorSuffix && withoutCreatorSuffix !== exact
    ? [exact, withoutCreatorSuffix]
    : [exact]
}

async function loadGlobalLevels() {
  if (!levelsPromise) {
    levelsPromise = fetch(DATA_URL, { headers: { Accept: 'application/json' } })
      .then(response => {
        if (!response.ok) throw new Error(`Global Demonlist data error: ${response.status}`)
        return response.json()
      })
      .then(payload => Array.isArray(payload?.levels) ? payload.levels : [])
      .catch(error => {
        levelsPromise = null
        throw error
      })
  }
  return levelsPromise
}

export async function getGlobalLevelArtworkIndex() {
  const levels = await loadGlobalLevels()
  const byGameId = new Map()
  const byName = new Map()

  levels.forEach(level => {
    const artwork = {
      placement: level.placement || 0,
      verifier: level.verifier || '',
      thumbnail: getYouTubeThumbnail(level.verificationUrl),
    }
    if (level.gameId) byGameId.set(String(level.gameId), artwork)
    const nameKey = normalizeName(level.name)
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, artwork)
  })

  return {
    match(level) {
      const gameIdMatch = level.gameId ? byGameId.get(String(level.gameId)) : null
      const nameMatch = getLookupNames(level.name)
        .map(name => byName.get(name))
        .find(Boolean)
      return gameIdMatch || nameMatch || null
    },
  }
}
