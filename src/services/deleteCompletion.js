import { doc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { getDocument } from './firestore'
import { communityPoints, roundPoints } from '../utils/communityPoints'
import { recalculateCommunityScores } from './communityList'

export async function deleteCompletionRecord(completionId) {
  const completion = await getDocument('completions', completionId)
  if (!completion) throw new Error('Completion not found')

  const batch = writeBatch(db)
  batch.delete(doc(db, 'completions', completionId))

  let removedPoints = completion.points || 0

  const level = completion.levelId ? await getDocument('levels', completion.levelId) : null
  if (level) {
    const prevVictors = level.victors || []
    const newVictors = prevVictors.filter(v => v.userId !== completion.userId)
    const removedCount = prevVictors.length - newVictors.length

    if (completion.levelType === 'community') {
      removedPoints = communityPoints(level.position || 0)
    }

    const update = {
      victors: newVictors,
      victoryCount: Math.max(0, (level.victoryCount || 0) - removedCount),
    }
    if (completion.levelType === 'community' && newVictors.length === 0) {
      update.position = 0
      update.points = 0
    }
    batch.update(doc(db, 'levels', level.id), update)
  }

  const userDoc = await getDocument('users', completion.userId)
  if (userDoc) {
    const stats = userDoc.stats || {}
    const pointsField = completion.levelType === 'community' ? 'communityPoints' : 'mainPoints'
    const countField = completion.levelType === 'community' ? 'communityCompletions' : 'mainCompletions'
    batch.update(doc(db, 'users', completion.userId), {
      stats: {
        ...stats,
        totalPoints: roundPoints(Math.max(0, (stats.totalPoints || 0) - removedPoints)),
        [pointsField]: roundPoints(Math.max(0, (stats[pointsField] || 0) - removedPoints)),
        [countField]: Math.max(0, (stats[countField] || 0) - 1),
      },
    })
  }

  await batch.commit()
  if (completion.levelType === 'community' && level) {
    await recalculateCommunityScores()
  }
  return { removedPoints }
}
