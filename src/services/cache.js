import { db } from './firebase'
import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore'
import { fetchDemonList, mapGDLDemon } from './gdl'

const CACHE_DURATION = 60 * 60 * 1000
const BATCH_LIMIT = 500

function chunk(arr, size) {
  const result = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

async function getLatestUpdate() {
  const snap = await getDocs(collection(db, 'levels'))
  let latest = null
  snap.forEach(d => {
    const data = d.data()
    if (data.type === 'main') {
      const t = data.updatedAt?.toMillis?.() || 0
      if (!latest || t > latest) latest = t
    }
  })
  return latest
}

async function clearOldMainLevels() {
  const snap = await getDocs(collection(db, 'levels'))
  const deletePromises = []
  snap.forEach(d => {
    if (d.data().type === 'main') {
      deletePromises.push(deleteDoc(d.ref))
    }
  })
  await Promise.all(deletePromises)
}

export async function syncMainLevels(force = false) {
  try {
    if (!force) {
      const latest = await getLatestUpdate()
      if (latest && Date.now() - latest < CACHE_DURATION) return false
    }

    const data = await fetchDemonList()
    const demons = Array.isArray(data) ? data : data.demons || []

    if (force) {
      await clearOldMainLevels()
    }

    const chunks = chunk(demons, BATCH_LIMIT)
    for (const group of chunks) {
      const batch = writeBatch(db)
      for (const demon of group) {
        const mapped = mapGDLDemon(demon)
        const ref = doc(db, 'levels', `main_${mapped.apiId}`)
        batch.set(ref, { ...mapped, type: 'main', isActive: true, updatedAt: new Date() }, { merge: true })
      }
      await batch.commit()
    }

    return true
  } catch (err) {
    console.error('syncMainLevels error:', err)
    throw err
  }
}
