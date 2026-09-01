import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Globe2, MapPinned } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { updateDocument } from '../../services/firestore'
import { invalidateCache } from '../../services/readCache'
import { syncVictorsSnapshot } from '../../services/syncUsernames'
import { COUNTRIES, getFlagUrl } from '../../utils/countries'
import {
  getSavedRepresentedCountry,
  normalizeRepresentedCountry,
  saveRepresentedCountry,
} from '../../utils/preferences'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import styles from './CountryOnboarding.module.css'

export default function CountryOnboarding() {
  const { user, userData, loading } = useAuth()
  const { locale, t } = useLanguage()
  const [selectedCountry, setSelectedCountry] = useState(getSavedRepresentedCountry)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const syncAttemptRef = useRef('')

  const countryNames = useMemo(() => {
    let displayNames = null
    try {
      displayNames = new Intl.DisplayNames([locale], { type: 'region' })
    } catch {}

    return COUNTRIES
      .map(country => ({
        value: country.code,
        label: displayNames?.of(country.code) || country.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale))
  }, [locale])

  const saveToProfile = useCallback(async (code) => {
    if (!user || !userData) return
    await updateDocument('users', user.uid, { country: code })
    invalidateCache('users')
    try {
      await syncVictorsSnapshot(user.uid, {
        username: userData.username || '',
        displayName: userData.displayName || userData.username || '',
        country: code,
        avatarURL: userData.avatarURL || '',
      })
    } catch (syncError) {
      console.warn('Country victor sync was deferred:', syncError)
    }
  }, [user, userData])

  useEffect(() => {
    if (loading) return

    const profileCountry = normalizeRepresentedCountry(userData?.country)
    if (profileCountry) {
      saveRepresentedCountry(profileCountry)
      setSelectedCountry(profileCountry)
      setOpen(false)
      setError('')
      return
    }

    const savedCountry = getSavedRepresentedCountry()
    if (!savedCountry) {
      setOpen(true)
      return
    }

    setSelectedCountry(savedCountry)
    setOpen(false)

    if (user && userData) {
      const attemptKey = `${user.uid}:${savedCountry}`
      if (syncAttemptRef.current === attemptKey) return
      syncAttemptRef.current = attemptKey
      saveToProfile(savedCountry).catch(syncError => {
        console.error('Failed to save represented country:', syncError)
        setError(t('countrySetup.saveError'))
        setOpen(true)
      })
    }
  }, [loading, saveToProfile, t, user, userData])

  const handleSave = async () => {
    const code = normalizeRepresentedCountry(selectedCountry)
    if (!code) {
      setError(t('countrySetup.required'))
      return
    }

    setSaving(true)
    setError('')
    try {
      if (user && userData) await saveToProfile(code)
      saveRepresentedCountry(code)
      setOpen(false)
    } catch (saveError) {
      console.error('Failed to save represented country:', saveError)
      setError(t('countrySetup.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={() => {}}
      title={t('countrySetup.title')}
      ariaDescribedBy="country-setup-description"
      dismissible={false}
    >
      <div className={styles.content}>
        <div className={styles.icon} aria-hidden="true"><Globe2 size={30} /></div>
        <p id="country-setup-description" className={styles.description}>{t('countrySetup.description')}</p>
        <Select
          label={t('countrySetup.label')}
          value={selectedCountry}
          onChange={event => { setSelectedCountry(event.target.value); setError('') }}
          placeholder={t('countrySetup.placeholder')}
          options={countryNames}
          error={error}
        />
        {selectedCountry && getFlagUrl(selectedCountry, 80) && (
          <div className={styles.selection} aria-live="polite">
            <img src={getFlagUrl(selectedCountry, 80)} alt="" />
            <MapPinned size={16} aria-hidden="true" />
            <span>{countryNames.find(country => country.value === selectedCountry)?.label}</span>
          </div>
        )}
        <Button variant="primary" onClick={handleSave} loading={saving} className={styles.saveButton}>
          {saving ? t('countrySetup.saving') : t('countrySetup.save')}
        </Button>
        <p className={styles.note}>{t('countrySetup.note')}</p>
      </div>
    </Modal>
  )
}
