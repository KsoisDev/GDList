import { useAuth } from '../../hooks/useAuth'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { hasAccess } from '../../utils/constants'
import Maintenance from '../../pages/Maintenance'
import Spinner from '../ui/Spinner'
import styles from './Guards.module.css'

export default function RequireMaintenanceAccess({ children }) {
  const { userData, loading: authLoading } = useAuth()
  const { maintenance, maintenanceMessage, loading: configLoading } = useSiteConfig()

  if (authLoading || configLoading) {
    return (
      <div className={styles.loading}><Spinner size="lg" /></div>
    )
  }

  if (maintenance && !hasAccess(userData?.role || 'user', 'admin')) {
    return <Maintenance message={maintenanceMessage} />
  }

  return children
}
