import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUTPUT = resolve(ROOT, 'public', 'gdl-levels.json')
const API_URL = 'https://api.demonlist.org/level/classic/list?limit=2000&offset=0'
const CACHE_MS = 6 * 60 * 60 * 1000

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

  const compactLevels = levels
    .filter(level => level.ingame_id && level.verification_url)
    .map(level => ({
      gameId: String(level.ingame_id),
      name: level.name,
      placement: level.placement,
      verifier: level.verifier?.username || '',
      verificationUrl: level.verification_url,
    }))

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
