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