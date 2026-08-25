import { Award, Crown, Diamond, Flame, Gem, Medal, Mountain, Skull, Sparkles, Swords, Trophy } from 'lucide-react'

export const RANKS = [
  { id: 'unranked', name: 'Unranked', min: 0, icon: Mountain, from: '#64748b', to: '#a8b6cc', glow: 'rgba(148, 163, 184, 0.30)' },
  { id: 'bronze', name: 'Bronze', min: 250, icon: Medal, from: '#a05a2c', to: '#e08a3c', glow: 'rgba(217, 119, 6, 0.35)' },
  { id: 'silver', name: 'Silver', min: 750, icon: Award, from: '#8595ab', to: '#dbe4f0', glow: 'rgba(203, 213, 225, 0.35)' },
  { id: 'gold', name: 'Gold', min: 1500, icon: Trophy, from: '#c47b0a', to: '#ffd166', glow: 'rgba(250, 204, 21, 0.40)' },
  { id: 'platinum', name: 'Platinum', min: 2500, icon: Gem, from: '#0f9488', to: '#5eead4', glow: 'rgba(45, 212, 191, 0.40)' },
  { id: 'diamond', name: 'Diamond', min: 4000, icon: Diamond, from: '#2563eb', to: '#7dd3fc', glow: 'rgba(56, 189, 248, 0.45)' },
  { id: 'master', name: 'Master', min: 6000, icon: Flame, from: '#dc4b04', to: '#ff9040', glow: 'rgba(249, 115, 22, 0.45)' },
  { id: 'grandmaster', name: 'Grandmaster', min: 8500, icon: Crown, from: '#6d28d9', to: '#b79bff', glow: 'rgba(139, 92, 246, 0.45)' },
  { id: 'legend', name: 'Legend', min: 12000, icon: Swords, from: '#be123c', to: '#fb7185', glow: 'rgba(244, 63, 94, 0.45)' },
  { id: 'mythic', name: 'Mythic', min: 16000, icon: Skull, from: '#701a75', to: '#e879f9', glow: 'rgba(192, 38, 211, 0.50)' },
  { id: 'immortal', name: 'Immortal', min: 22000, icon: Sparkles, from: '#b45309', to: '#fef08a', glow: 'rgba(253, 230, 138, 0.55)' },
]

export function getRankInfo(totalPoints) {
  const points = Math.max(0, Number(totalPoints) || 0)
  let index = 0
  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (points >= RANKS[i].min) {
      index = i
      break
    }
  }
  const rank = RANKS[index]
  const nextRank = RANKS[index + 1] || null
  const floor = rank.min
  const ceil = nextRank ? nextRank.min : floor
  const span = ceil - floor
  const progressPct = nextRank && span > 0 ? Math.min(100, ((points - floor) / span) * 100) : 100
  const pointsToNext = nextRank ? Math.max(0, ceil - points) : 0

  return {
    rank,
    nextRank,
    tier: index + 1,
    totalTiers: RANKS.length,
    progressPct,
    pointsToNext,
  }
}
