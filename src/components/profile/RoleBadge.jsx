import { Ban, Code2, Crown, Shield, User as UserIcon } from 'lucide-react'
import Badge from '../ui/Badge'

const LIST_DEVELOPER_USERNAMES = new Set(['ntyu2', 'ksois'])

export default function RoleBadge({ role = 'user', title = '', username = '', banned = false, size = 'sm' }) {
  const isVerifiedListDeveloper = LIST_DEVELOPER_USERNAMES.has(username.trim().toLowerCase())
  const showDeveloperBadge = role === 'developer' || title === 'List Developer' || isVerifiedListDeveloper
  const developerBadge = (
    <Badge variant="gold" size={size}><Code2 size={12} aria-hidden="true" /> List Dev</Badge>
  )

  if (banned) {
    return <Badge variant="red" size={size}><Ban size={12} aria-hidden="true" /> Banned</Badge>
  }

  if (role === 'developer') {
    return developerBadge
  }

  if (role === 'owner') {
    return (
      <>
        <Badge variant="gold" size={size}><Crown size={12} aria-hidden="true" /> Owner</Badge>
        {showDeveloperBadge ? developerBadge : null}
      </>
    )
  }

  if (role === 'admin') {
    return (
      <>
        <Badge variant="purple" size={size}><Shield size={12} aria-hidden="true" /> Admin</Badge>
        {showDeveloperBadge ? developerBadge : null}
      </>
    )
  }

  if (showDeveloperBadge) {
    return developerBadge
  }

  return <Badge variant="default" size={size}><UserIcon size={12} aria-hidden="true" /> Player</Badge>
}
