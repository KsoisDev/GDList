export function isValidYouTubeUrl(url) {
  if (!url) return false
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]{11}/,
  ]
  return patterns.some(p => p.test(url))
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidUsername(username) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(username)
}
