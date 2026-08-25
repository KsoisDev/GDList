import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const outputPath = resolve('public/main-levels.json')
const envFiles = ['.env.github.local', '.env.local', '.env.github', '.env']

function loadLocalEnv() {
  for (const file of envFiles) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/)
      if (!match || process.env[match[1]]) continue
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
}

function decodeValue(value = {}) {
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('timestampValue' in value) return value.timestampValue
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue)
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {})
  return undefined
}

function decodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  )
}

function safeVictors(victors) {
  if (!Array.isArray(victors)) return []
  return victors
    .filter(victor => victor && typeof victor.userId === 'string')
    .map(victor => ({ userId: victor.userId }))
}

async function fetchDocuments(projectId, apiKey) {
  const documents = []
  let pageToken = ''

  do {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/levels`,
    )
    url.searchParams.set('pageSize', '300')
    url.searchParams.set('key', apiKey)
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`Firestore returned HTTP ${response.status}`)
    const page = await response.json()
    documents.push(...(page.documents || []))
    pageToken = page.nextPageToken || ''
  } while (pageToken)

  return documents
}

async function main() {
  loadLocalEnv()
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID
  const apiKey = process.env.VITE_FIREBASE_API_KEY

  if (!projectId || !apiKey) {
    console.warn('[main-list] Firebase config unavailable; keeping the committed fallback')
    return
  }

  try {
    const documents = await fetchDocuments(projectId, apiKey)
    const levels = documents
      .map(document => ({
        id: document.name.split('/').pop(),
        ...decodeFields(document.fields || {}),
      }))
      .filter(level => level.type === 'main' && Number(level.victoryCount) > 0)
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map(level => ({
        id: level.id,
        name: String(level.name || 'Unknown level'),
        position: Number(level.position) || 0,
        points: Number(level.points) || 0,
        creator: String(level.creator || 'Unknown'),
        difficulty: String(level.difficulty || 'Extreme Demon'),
        victoryCount: Number(level.victoryCount) || 0,
        victors: safeVictors(level.victors),
      }))

    if (levels.length === 0) throw new Error('Firestore returned no completed main levels')

    if (existsSync(outputPath)) {
      const existing = JSON.parse(readFileSync(outputPath, 'utf8'))
      if (JSON.stringify(existing.levels) === JSON.stringify(levels)) {
        console.log(`[main-list] ${levels.length} completed Basement levels already cached`)
        return
      }
    }

    writeFileSync(outputPath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), levels }, null, 2)}\n`)
    console.log(`[main-list] saved ${levels.length} completed Basement levels`)
  } catch (error) {
    if (!existsSync(outputPath)) throw error
    console.warn(`[main-list] ${error.message}; keeping the committed fallback`)
  }
}

await main()
