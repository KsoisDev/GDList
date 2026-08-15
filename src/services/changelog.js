import { createDocument, getCollection, where } from './firestore'

const ACTIONS = {
  added: 'Added',
  removed: 'Removed',
  moved: 'Moved',
  renumbered: 'Renumbered',
}

export function changelogActionLabel(action) {
  return ACTIONS[action] || action || 'Updated'
}

export async function logLevelChange({ levelId, action, from = null, to = null, note = '' }) {
  if (!levelId) return
  try {
    await createDocument('changelog', null, {
      levelId,
      action,
      from: from != null ? Number(from) : null,
      to: to != null ? Number(to) : null,
      note,
    })
  } catch (err) {
    console.error('Failed to write changelog:', err)
  }
}

export async function getLevelChangelog(levelId) {
  const data = await getCollection('changelog', [where('levelId', '==', levelId)])
  return data.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() || 0
    const tb = b.createdAt?.toMillis?.() || 0
    return tb - ta
  })
}