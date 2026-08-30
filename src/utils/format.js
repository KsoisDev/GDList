export function parseDecimal(value) {
  if (value == null || value === '') return NaN
  const normalized = String(value).trim().replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : NaN
}

export function formatNumber(num) {
  if (!num && num !== 0) return '0'
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
  const n = Number(num)
  return Number.isInteger(n) ? n.toString() : n.toFixed(2)
}

export function getDisplayName(user) {
  return user?.displayName || user?.username || 'Unknown'
}

export function formatDate(timestamp, locale = 'en-US') {
  if (!timestamp) return 'N/A'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateRelative(timestamp, locale = 'en-US') {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  if (minutes < 1) return relative.format(0, 'second')
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 30) return relative.format(-days, 'day')
  return formatDate(timestamp, locale)
}
