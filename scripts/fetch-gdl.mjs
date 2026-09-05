import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUTPUT = resolve(ROOT, 'public', 'gdl-levels.json')
const API_URL = 'https://api.demonlist.org/level/classic/list?limit=2000&offset=0'
const CACHE_MS = 6 * 60 * 60 * 1000

const YT_WATCH = /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|\/shorts\/)([\w-]{11})/
const YT_BE = /youtu\.be\/([\w-]{11})/
const YT_EMBED = /youtube\.com\/embed\/([\w-]{11})/
const YT_BARE_ID = /^[\w-]{11}$/

function youtubeIdFromUrl(url) {
  const value = String(url || '').trim()
  if (!value) return ''
  const match = value.match(YT_WATCH) || value.match(YT_BE) || value.match(YT_EMBED)
  if (match) return match[1]
  const [base] = value.split('?')
  return YT_BARE_ID.test(base) && !base.includes('/') && !base.includes('.') ? base : ''
}

// Some API entries store only the raw 11-char video id (optionally with a
// ?si= share param) instead of a full URL. Normalize those so thumbnail
// resolution works downstream.
function normalizeVerificationUrl(url) {
  const value = String(url || '').trim()
  if (!value) return ''
  const [base] = value.split('?')
  if (YT_BARE_ID.test(base) && !base.includes('/') && !base.includes('.')) {
    return `https://www.youtube.com/watch?v=${base}`
  }
  return value
}

const normalizeName = name => String(name || '').trim().toLowerCase()

// The API can list several entries under one normalized name (re-uploads,
// stale rows). Keep a single row per name: prefer one with a usable
// thumbnail, tiebreak on lowest placement. gameId matching at runtime is
// unaffected since it keys off exact ids.
function dedupeByName(entries) {
  const best = new Map()
  for (const entry of entries) {
    const key = normalizeName(entry.name)
    if (!key) continue
    const prev = best.get(key)
    if (!prev) {
      best.set(key, entry)
      continue
    }
    const prevThumb = youtubeIdFromUrl(prev.verificationUrl) !== ''
    const nextThumb = youtubeIdFromUrl(entry.verificationUrl) !== ''
    if (nextThumb && !prevThumb) {
      best.set(key, entry)
    } else if (nextThumb === prevThumb && (entry.placement || 99999) < (prev.placement || 99999)) {
      best.set(key, entry)
    }
  }
  return [...best.values()]
}

async function main() {
  if (existsSync(OUTPUT) && Date.now() - statSync(OUTPUT).mtimeMs < CACHE_MS) {
    console.log('[gdl] cached, skipping download')
    return
  }

  console.log('[gdl] fetching public level artwork data...')
  const response = await fetch(API_URL, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const payload = await response.json()
  const levels = payload?.data?.levels
  if (!Array.isArray(levels)) throw new Error('Unexpected Global Demonlist response')

  const compactLevels = dedupeByName(levels
    .filter(level => level.ingame_id && level.verification_url)
    .map(level => ({
      gameId: String(level.ingame_id),
      name: level.name,
      placement: level.placement,
      verifier: level.verifier?.username || '',
      verificationUrl: normalizeVerificationUrl(level.verification_url),
    })))

  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, JSON.stringify({
    _meta: {
      source: 'Global Demonlist public API (https://api.demonlist.org)',
      generatedAt: new Date().toISOString(),
      count: compactLevels.length,
    },
    levels: compactLevels,
  }))
  console.log(`[gdl] wrote ${compactLevels.length} levels -> public/gdl-levels.json`)
}

main().catch(error => {
  if (existsSync(OUTPUT)) {
    console.warn(`[gdl] refresh failed; keeping committed fallback: ${error.message}`)
    return
  }
  console.error(`[gdl] failed: ${error.message}`)
  process.exit(1)
})
