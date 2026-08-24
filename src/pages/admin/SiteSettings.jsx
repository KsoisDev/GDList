import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Save } from 'lucide-react'
import PageShell from '../../components/layout/PageShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { useSiteConfig } from '../../hooks/useSiteConfig'
import { getDocument, updateDocument, createDocument } from '../../services/firestore'
import { hasAccess } from '../../utils/constants'
import styles from './Admin.module.css'
import siteStyles from './SiteSettings.module.css'

export default function SiteSettings() {
  const { user, userData, loading: authLoading } = useAuth()
  const { refresh } = useSiteConfig()
  const navigate = useNavigate()
  const [maintenance, setMaintenance] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const role = userData?.role || 'user'
  const isAdmin = hasAccess(role, 'admin')

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/')
  }, [user, userData, authLoading, navigate, isAdmin])

  useEffect(() => {
    async function load() {
      try {
        const data = await getDocument('settings', 'site')
        setMaintenance(!!data?.maintenance)
        setMessage(data?.maintenanceMessage || '')
      } catch (err) {
        console.error(err)
        setError('Failed to load settings.')
      } finally {
        setLoading(false)
      }
    }
    if (isAdmin) load()
  }, [isAdmin])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const data = { maintenance, maintenanceMessage: message.trim() }
      const existing = await getDocument('settings', 'site')
      if (existing) {
        await updateDocument('settings', 'site', data)
      } else {
        await createDocument('settings', 'site', data)
      }
      await refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error(err)
      setError('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return <PageShell><div className={styles.loading}><Spinner size="lg" /></div></PageShell>
  }

  return (
    <PageShell title="Site Settings" subtitle="Manage global site configuration">
      <Card padding="lg" className={styles.formCard}>
        <div className={siteStyles.card}>
          <div className={siteStyles.cardHeader}>
            <span className={siteStyles.cardIcon}>
              <Wrench size={20} />
            </span>
            <div>
              <h3 className={siteStyles.cardTitle}>Maintenance Mode</h3>
              <p className={siteStyles.cardDesc}>
                While enabled, regular users cannot view rankings or submit anything. Admins keep full access.
              </p>
            </div>
          </div>

          <div className={siteStyles.row}>
            <div>
              <div className={siteStyles.switchLabel}>Enable maintenance mode</div>
              <div className={siteStyles.switchSub}>
                Status:{' '}
                <strong className={maintenance ? siteStyles.statusOn : siteStyles.statusOff}>
                  {maintenance ? 'ON' : 'OFF'}
                </strong>
              </div>
            </div>
            <button
              type="button"
              className={`${siteStyles.switch} ${maintenance ? siteStyles.switchOn : ''}`}
              onClick={() => setMaintenance(!maintenance)}
              aria-pressed={maintenance}
              aria-label="Toggle maintenance mode"
            >
              <span className={siteStyles.knob} />
            </button>
          </div>

          <div className={siteStyles.field}>
            <label className={siteStyles.label} htmlFor="maintenance-message">Message shown to users</label>
            <textarea
              id="maintenance-message"
              className={siteStyles.textarea}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="We're doing some maintenance right now. Please check back soon."
              rows={3}
            />
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
          {saved && <p className={siteStyles.saved} role="status">Settings saved.</p>}

          <div className={siteStyles.actions}>
            <Button variant="primary" onClick={handleSave} loading={saving} icon={Save}>
              Save Settings
            </Button>
          </div>
        </div>
      </Card>
    </PageShell>
  )
}
