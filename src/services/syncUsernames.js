import { getCollection, updateDocument } from './firestore'

export async function syncVictorsSnapshot(userId, fields) {
  const all = await getCollection('levels')
  const targets = all.filter(l => (l.victors || []).some(v => v.userId === userId))
  await Promise.all(
    targets.map(level =>
      updateDocument('levels', level.id, {
        victors: (level.victors || []).map(v =>
          v.userId === userId ? { ...v, ...fields } : v
        ),
      })
    )
  )
}