const GDL_BASE = import.meta.env.VITE_GDL_API_BASE || 'https://pointercrate.com/api/v2'

export async function fetchDemonList() {
  let allDemons = []
  let after = 0
  let hasMore = true

  while (hasMore) {
    const url = after ? `${GDL_BASE}/demons/listed/?limit=100&after=${after}` : `${GDL_BASE}/demons/listed/?limit=100`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      hasMore = false
    } else {
      allDemons = allDemons.concat(data)
      after = data[data.length - 1].position
      if (data.length < 100) hasMore = false
    }
  }

  return allDemons
}

export async function fetchListedDemons(max = 500) {
  const all = []
  let after = 0
  while (all.length < max) {
    const remaining = max - all.length
    const limit = Math.min(remaining, 100)
    const url = after ? `${GDL_BASE}/demons/listed/?limit=${limit}&after=${after}` : `${GDL_BASE}/demons/listed/?limit=${limit}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    all.push(...data)
    if (data.length < limit) break
    after = data[data.length - 1].position
  }
  return all
}

export async function fetchDemonById(id) {
  const res = await fetch(`${GDL_BASE}/demons/${id}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export function mapGDLDemon(demon) {
  const points = demon.position ? Math.max(1, 1001 - demon.position) : 0
  return {
    position: demon.position || 0,
    name: demon.name,
    creator: demon.publisher?.name || (demon.creators?.[0]?.name) || 'Unknown',
    verifier: demon.verifier?.name || 'Unknown',
    difficulty: 'Extreme Demon',
    difficultyFace: demon.difficulty_face || '',
    points,
    thumbnail: demon.thumbnail || '',
    players: 0,
    percentage: demon.requirement || 100,
    apiId: String(demon.id),
  }
}
