import { deleteUser } from 'firebase/auth'
import { where, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { getCollection, getDocument } from './firestore'
import { recalculateCommunityScores } from './communityList'

export async function deleteAccount(userId) {
  const results = { submissions: 0, completions: 0, notifications: 0, levels: 0, usernames: 0, staff: 0 }
  const errors = []

  try {
    const profile = await getDocument('users', userId)
    if (profile?.usernameLower) {
      await deleteDoc(doc(db, 'usernames', profile.usernameLower))
      results.usernames++
    }
  } catch (e) { errors.push(`username: ${e.message}`) }

  try {
    const userSubs = await getCollection('submissions', [where('userId', '==', userId)])
    for (const sub of userSubs) {
      await deleteDoc(doc(db, 'submissions', sub.id))
      results.submissions++
    }
  } catch (e) { errors.push(`submissions: ${e.message}`) }

  try {
    const userComps = await getCollection('completions', [where('userId', '==', userId)])
    for (const comp of userComps) {
      await deleteDoc(doc(db, 'completions', comp.id))
      results.completions++
    }
  } catch (e) { errors.push(`completions: ${e.message}`) }

  try {
    const userNotifs = await getCollection('notifications', [where('userId', '==', userId)])
    for (const notif of userNotifs) {
      await deleteDoc(doc(db, 'notifications', notif.id))
      results.notifications++
    }
  } catch (e) { errors.push(`notifications: ${e.message}`) }

  try {
    const allLevels = await getCollection('levels')
    const affectedLevels = allLevels.filter(l => (l.victors || []).some(v => v.userId === userId))
    for (const level of affectedLevels) {
      await updateDoc(doc(db, 'levels', level.id), {
        victors: (level.victors || []).filter(v => v.userId !== userId),
        victoryCount: Math.max(0, (level.victoryCount || 0) - 1),
      })
      results.levels++
    }
    if (affectedLevels.some(level => level.type === 'community')) {
      await recalculateCommunityScores()
    }
  } catch (e) { errors.push(`levels: ${e.message}`) }

  try {
    const staff = await getDocument('staff', userId)
    if (staff) {
      await deleteDoc(doc(db, 'staff', userId))
      results.staff++
    }
  } catch (e) { errors.push(`staff: ${e.message}`) }

  try {
    await deleteDoc(doc(db, 'users', userId))
  } catch (e) { errors.push(`users: ${e.message}`) }

  try {
    const user = auth.currentUser
    if (user) await deleteUser(user)
  } catch (e) { errors.push(`auth: ${e.message}`) }

  if (errors.length > 0) {
    throw new Error(errors.join('; '))
  }

  return results
}
