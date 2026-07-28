import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

function compressImage(file, maxSize = 256, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > h && w > maxSize) { h = (h / w) * maxSize; w = maxSize }
      else if (h > maxSize) { w = (w / h) * maxSize; h = maxSize }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Compression failed')); return }
        resolve(blob)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

export async function uploadAvatar(file, userId, onProgress) {
  const compressed = await compressImage(file)
  const storageRef = ref(storage, `avatars/${userId}`)

  const task = uploadBytesResumable(storageRef, compressed)

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        if (onProgress) onProgress(progress)
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      }
    )
  })
}
