import { Wrench } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { hasAccess } from '../../utils/constants'
import styles from './Guards.module.css'

export default function MaintenanceBanner() {
  const { userData } = useAuth()
  const { maintenance, maintenanceMessage, loading } = useSiteConfig()

  if (loading || !maintenance || hasAccess(userData?.role || 'user', 'admin')) {
    return null
  }

  return (
    <div className={styles.banner}>
      <Wrench size={16} />
      <span>{maintenanceMessage || "We're doing some maintenance right now. Please check back soon."}</span>
    </div>
  )
}
