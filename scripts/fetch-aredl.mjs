import { writeFileSync, existsSync, readFileSync, mkdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUTPUT = resolve(ROOT, 'public', 'aredl-levels.json')
const NAMES_FILE = resolve(__dirname, 'aredl-names.json')
const CACHE_FILE = resolve(ROOT, 'node_modules', '.cache', 'aredl-live.json')
const CONCURRENCY = 2
const REQUEST_DELAY_MS = 200

const LIST_URL = 'https://api.aredl.net/v2/api/aredl/levels?exclude_legacy=true'
const DETAIL_URL = id => `https://api.aredl.net/v2/api/aredl/levels/${id}`
const CACHE_MS = 6 * 60 * 60 * 1000
const REFRESH = process.env.AREDL_REFRESH === '1'

const sleep = ms => new Promise(r => setTimeout(r, ms))

const slugify = name =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'level'

async function fetchBody(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function withRetry(fn, attempts = 5) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const is429 = /429/.test(String(err.message))
      await sleep(is429 ? 4000 + i * 2000 : 600 * (i + 1))
    }
  }
  throw lastErr
}

async function pipeWithLimit(items, worker) {
  const results = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (true) {
      const idx = next++
      if (idx >= items.length) return
      results[idx] = await worker(items[idx], idx)
      await sleep(REQUEST_DELAY_MS)
    }
  })
  await Promise.all(runners)
  return results
}

async function refreshNames(levels) {
  console.log('[aredl] refresh mode: resolving details (AREDL_REFRESH=1)')
  let cache = { details: {} }
  mkdirSync(resolve(ROOT, 'node_modules', '.cache'), { recursive: true })
  if (existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
    } catch {
      cache = { details: {} }
    }
  }
  const toFetch = levels.filter(l => cache.details[l.id]?.status !== 'ok').map(l => l.id)
  console.log(`[aredl] resolving details for ${toFetch.length} levels (${Object.keys(cache.details).length} cached)`)
  await pipeWithLimit(toFetch, async id => {
    try {
      const detail = await withRetry(() => fetchBody(DETAIL_URL(id)))
      cache.details[id] = { status: 'ok', detail }
    } catch (err) {
      console.warn(`[aredl] ${id} -> ${err.message}`)
      cache.details[id] = { status: 'failed', err: String(err.message) }
    }
  })
  writeFileSync(CACHE_FILE, JSON.stringify(cache))

  const names = {}
  for (const [id, v] of Object.entries(cache.details)) {
    if (v.status !== 'ok') continue
    const d = v.detail
    names[id] = {
      publisher: d.publisher?.global_name || d.publisher?.username || undefined,
      verifier:
        d.verifications?.[0]?.submitted_by?.global_name ||
        d.verifications?.[0]?.submitted_by?.username ||
        undefined,
    }
  }
  writeFileSync(NAMES_FILE, JSON.stringify(names, null, 1))
  console.log(`[aredl] names map updated: ${Object.keys(names).length} -> scripts/aredl-names.json`)
}

function loadNames() {
  if (!existsSync(NAMES_FILE)) {
    console.warn('[aredl] no committed names map found; creators/verifiers may be Unknown')
    return {}
  }
  return JSON.parse(readFileSync(NAMES_FILE, 'utf8'))
}

async function main() {
  if (!REFRESH && existsSync(OUTPUT) && Date.now() - statSync(OUTPUT).mtimeMs < CACHE_MS) {
    console.log('[aredl] cached, skipping download')
    return
  }

  console.log('[aredl] fetching live list...')
  const levels = await withRetry(() => fetchBody(LIST_URL))
  console.log(`[aredl] live list: ${levels.length} levels (Society #1)`)

  if (REFRESH) {
    await refreshNames(levels)
  }
  const names = loadNames()

  const oldByLevelId = new Map()
  try {
    const old = JSON.parse(readFileSync(OUTPUT, 'utf8'))
    for (const l of old.levels || []) {
      if (l.levelId != null) oldByLevelId.set(String(l.levelId), l)
    }
  } catch {
    /* first run */
  }

  const resolved = levels.map(l => {
    const n = names[l.id] || {}
    const old = oldByLevelId.get(String(l.level_id))
    return {
      slug: old?.slug || slugify(l.name),
      name: l.name,
      position: l.position,
      points: l.points != null ? l.points / 10 : null,
      levelId: l.level_id,
      twoPlayer: Boolean(l.two_player),
      creators: n.publisher ? [n.publisher] : ['Unknown'],
      verifier: n.verifier || 'Unknown',
      percentage: 100,
    }
  })

  resolved.sort((a, b) => a.position - b.position)
  const payload = {
    _meta: {
      source: 'aredl.net v2 API (https://api.aredl.net/v2/api/aredl/levels) + names map',
      generatedAt: new Date().toISOString(),
      count: resolved.length,
    },
    levels: resolved,
  }
  writeFileSync(OUTPUT, JSON.stringify(payload))
  console.log(`[aredl] wrote ${resolved.length} levels -> public/aredl-levels.json`)
}

main().catch(err => {
  console.error('[aredl] failed:', err.message)
  process.exit(1)
})