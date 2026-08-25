import { Fragment } from 'react'
import { Ban, Code2, Crown, Shield, User as UserIcon } from 'lucide-react'
import Badge from '../ui/Badge'

const LIST_DEVELOPER_USERNAMES = new Set(['ntyu2', 'ksois'])

export default function RoleBadge({ role = 'user', title = '', username = '', banned = false, isDeveloper = false, size = 'sm' }) {
  if (banned) {
    return <Badge variant="red" size={size}><Ban size={12} aria-hidden="true" /> Banned</Badge>
  }

  const hasDevBadge = Boolean(isDeveloper)
    || role === 'developer'
    || title === 'List Developer'
    || LIST_DEVELOPER_USERNAMES.has(username.trim().toLowerCase())

  const effectiveRole = role === 'developer' ? 'owner' : role

  return (
    <Fragment>
      {effectiveRole === 'owner' && (
        <Badge variant="gold" size={size}><Crown size={12} aria-hidden="true" /> Owner</Badge>
      )}
      {effectiveRole === 'admin' && (
        <Badge variant="purple" size={size}><Shield size={12} aria-hidden="true" /> Admin</Badge>
      )}
      {effectiveRole !== 'owner' && effectiveRole !== 'admin' && (
        <Badge variant="default" size={size}><UserIcon size={12} aria-hidden="true" /> Player</Badge>
      )}
      {hasDevBadge && (
        <Badge variant="gold" size={size}><Code2 size={12} aria-hidden="true" /> List Dev</Badge>
      )}
    </Fragment>
  )
}
