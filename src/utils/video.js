const YT_WATCH = /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|\/shorts\/)([\w-]{11})/
const YT_BE = /youtu\.be\/([\w-]{11})/
const YT_EMBED = /youtube\.com\/embed\/([\w-]{11})/
const YT_BARE_ID = /^[\w-]{11}$/

export function getYouTubeVideoId(url) {
  if (!url) return ''
  const value = String(url).trim()
  const match = value.match(YT_WATCH) || value.match(YT_BE) || value.match(YT_EMBED)
  if (match) return match[1]
  // Some stored URLs are only the raw 11-char video id (optionally with a
  // ?si= share param). Anything with slashes or dots is not a bare id.
  const [base] = value.split('?')
  return YT_BARE_ID.test(base) && !base.includes('/') && !base.includes('.') ? base : ''
}

export function getYouTubeThumbnail(url) {
  const id = getYouTubeVideoId(url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''
}

export function getDriveFileId(url) {
  if (!url) return ''
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/)
  return match ? match[1] : ''
}

export function getVideoThumbnail(url) {
  const yt = getYouTubeThumbnail(url)
  if (yt) return yt
  const drive = getDriveFileId(url)
  return drive ? `https://drive.google.com/thumbnail?id=${drive}&sz=w400` : ''
}
