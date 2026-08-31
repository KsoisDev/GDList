const GDL_API = 'https://demonlist.org/api/v1'

export async function searchGdlPlayers(query) {
  const res = await fetch(`${GDL_API}/players/?name_contains=${encodeURIComponent(query)}&limit=10`)
  if (!res.ok) throw new Error('GDL search failed')
  const data = await res.json()
  return Array.isArray(data) ? data : data.items || data.data || []
}

export async function fetchGdlPlayer(id) {
  const res = await fetch(`${GDL_API}/players/${id}/`)
  if (!res.ok) throw new Error('GDL player not found')
  const json = await res.json()
  return json.data || json
}

export function getGdlProfileUrl(playerId, playerName) {
  if (playerId) return `https://demonlist.org/profile/${playerId}`
  if (playerName) return `https://demonlist.org/profile?name=${encodeURIComponent(playerName)}`
  return 'https://demonlist.org'
}
