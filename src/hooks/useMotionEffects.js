import { useContext } from 'react'
import { MotionEffectsContext } from '../contexts/MotionEffectsContext'

export function useMotionEffects() {
  const context = useContext(MotionEffectsContext)

  if (!context) {
    throw new Error('useMotionEffects must be used inside MotionEffectsProvider')
  }

  return context
}
