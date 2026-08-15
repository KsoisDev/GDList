export function computeBadges(communityLevels, userId) {
  let firstVictorCount = 0
  let verifierCount = 0
  ;(communityLevels || []).forEach(level => {
    const first = (level.victors || [])[0]
    if (first && first.userId === userId) {
      firstVictorCount += 1
      if (level.videoURL) verifierCount += 1
    }
  })
  return { firstVictor: firstVictorCount > 0, verifier: verifierCount > 0 }
}