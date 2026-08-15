export function communityPointsForPosition(position) {
  const x = Math.max(1, Number(position) || 1)
  return 500 / (1 + Math.pow((x - 1) / 35, 0.85))
}

export function roundPoints(value) {
  return Math.round(value * 100) / 100
}

export function communityPoints(position) {
  return roundPoints(communityPointsForPosition(position))
}
