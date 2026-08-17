const YT_WATCH = /(?:youtube\.com\/watch\?v=|\/shorts\/)([\w-]{11})/
const YT_BE = /youtu\.be\/([\w-]{11})/
const YT_EMBED = /youtube\.com\/embed\/([\w-]{11})/

export function getYouTubeVideoId(url) {
  if (!url) return ''
  const match = url.match(YT_WATCH) || url.match(YT_BE) || url.match(YT_EMBED)
  return match ? match[1] : ''
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