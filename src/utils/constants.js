export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', color: '#00ff00', points: 10 },
  { id: 'medium', label: 'Medium', color: '#00ccff', points: 25 },
  { id: 'hard', label: 'Hard', color: '#ff8800', points: 50 },
  { id: 'harder', label: 'Harder', color: '#ff4488', points: 75 },
  { id: 'insane', label: 'Insane', color: '#ff0000', points: 100 },
  { id: 'extreme', label: 'Extreme Demon', color: '#aa00ff', points: 0 },
]

export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  OWNER: 'owner',
}

export const HIERARCHY = { user: 0, admin: 1, owner: 2 }

export function hasAccess(role, minRole) {
  const roleLevel = HIERARCHY[role]
  const requiredLevel = HIERARCHY[minRole]
  return Number.isInteger(roleLevel) && Number.isInteger(requiredLevel) && roleLevel >= requiredLevel
}

export const SUBMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const LEVEL_TYPES = {
  MAIN: 'main',
  COMMUNITY: 'community',
}

export const NAV_LINKS = [
  { path: '/', labelKey: 'nav.home' },
  { path: '/list/main', labelKey: 'nav.mainList' },
  { path: '/list/community', labelKey: 'nav.communityList' },
  { path: '/leaderboard/main', labelKey: 'nav.mainRankings' },
  { path: '/leaderboard/community', labelKey: 'nav.communityRankings' },
  { path: '/dev-log', labelKey: 'nav.devLog' },
]

export const DIFFICULTY_COLORS = {
  easy: '#00ff00',
  medium: '#00ccff',
  hard: '#ff8800',
  harder: '#ff4488',
  insane: '#ff0000',
  extreme: '#aa00ff',
}
