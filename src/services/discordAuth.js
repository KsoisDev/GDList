const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID

function resolveRedirectUri() {
  // Derive from the running origin so logins keep working on any host
  // (Netlify, GitHub Pages, preview URLs, or localhost).
  const base = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${base}/discord-callback.html`
}

const DISCORD_REDIRECT_URI = resolveRedirectUri()
const DISCORD_API = 'https://discord.com/api/v10'

const STORAGE_KEY = 'gdlist_discord_user'
const PENDING_KEY = 'gdlist_discord_pending'

export function getStoredDiscordUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeDiscordUser(user) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  } catch {}
}

export function clearDiscordUser() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function parseTokenHash(hash) {
  const params = new URLSearchParams(hash)
  return params.get('access_token')
}

export function startDiscordLogin() {
  if (!DISCORD_CLIENT_ID) {
    throw new Error('Discord Client ID not configured. Set VITE_DISCORD_CLIENT_ID in your .env.')
  }

  try {
    sessionStorage.setItem(PENDING_KEY, '1')
  } catch {}

  const url = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(DISCORD_CLIENT_ID)}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=token&scope=identify`
  location.href = url
}

export function hasPendingDiscordLogin() {
  try {
    return sessionStorage.getItem(PENDING_KEY) === '1'
  } catch {
    return false
  }
}

export function clearPendingDiscordLogin() {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {}
}

export async function completeDiscordLogin(hash) {
  const token = parseTokenHash(hash)
  if (!token) throw new Error('No access token received from Discord.')

  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Discord profile.')
  const user = await res.json()

  const info = {
    id: user.id,
    global_name: user.global_name || user.username,
    username: user.username,
    avatar: user.avatar,
    discriminator: user.discriminator,
  }
  storeDiscordUser(info)
  clearPendingDiscordLogin()
  return info
}
