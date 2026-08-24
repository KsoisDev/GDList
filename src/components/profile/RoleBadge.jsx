import { Ban, Code2, Crown, Shield, User as UserIcon } from 'lucide-react'
import Badge from '../ui/Badge'

export default function RoleBadge({ role = 'user', title = '', banned = false, size = 'sm' }) {
  if (banned) {
    return <Badge variant="red" size={size}><Ban size={12} aria-hidden="true" /> Banned</Badge>
  }

  if (role === 'developer' || title === 'List Developer') {
    return <Badge variant="blue" size={size}><Code2 size={12} aria-hidden="true" /> List Developer</Badge>
  }

  if (role === 'owner') {
    return <Badge variant="gold" size={size}><Crown size={12} aria-hidden="true" /> Owner</Badge>
  }

  if (role === 'admin') {
    return <Badge variant="purple" size={size}><Shield size={12} aria-hidden="true" /> Admin</Badge>
  }

  return <Badge variant="default" size={size}><UserIcon size={12} aria-hidden="true" /> Player</Badge>
}
