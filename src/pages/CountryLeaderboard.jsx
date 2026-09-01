import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Globe2, MapPinned, Medal, Trophy, Users } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import Avatar from '../components/ui/Avatar'
import SearchBar from '../components/ui/SearchBar'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import { useLanguage } from '../hooks/useLanguage'
import { loadUsers } from '../services/readCache'
import { COUNTRIES, getFlagUrl } from '../utils/countries'
import { formatNumber, getDisplayName } from '../utils/format'
import styles from './CountryLeaderboard.module.css'

const MODES = {
  main: { pointsKey: 'mainPoints', completionsKey: 'mainCompletions' },
  community: { pointsKey: 'communityPoints', completionsKey: 'communityCompletions' },
}

const countryByCode = new Map(COUNTRIES.map(country => [country.code, country]))

function getCountryName(code, displayNames) {
  return displayNames?.of(code) || countryByCode.get(code)?.name || code
}

export default function CountryLeaderboard() {
  const { t, locale } = useLanguage()
  const [users, setUsers] = useState([])
  const [mode, setMode] = useState('main')
  const [selectedCode, setSelectedCode] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const data = await loadUsers()
        if (active) setUsers(data)
      } catch (error) {
        console.error('Failed to load country rankings:', error)
        if (active) setLoadError('country.loadError')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [retryKey])

  const displayNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' })
    } catch {
      return null
    }
  }, [locale])

  const countries = useMemo(() => {
    const config = MODES[mode]
    const groups = new Map()

    users.forEach(player => {
      const code = String(player.country || '').trim().toUpperCase()
      if (!countryByCode.has(code)) return

      const points = Number(player.stats?.[config.pointsKey] || 0)
      if (!(points > 0)) return

      const completions = Number(player.stats?.[config.completionsKey] || 0)
      const current = groups.get(code) || { code, points: 0, completions: 0, players: [] }
      current.points += points
      current.completions += completions
      current.players.push({ ...player, _countryPoints: points, _countryCompletions: completions })
      groups.set(code, current)
    })

    return [...groups.values()]
      .map(country => ({
        ...country,
        name: getCountryName(country.code, displayNames),
        players: [...country.players].sort((a, b) => b._countryPoints - a._countryPoints),
      }))
      .sort((a, b) => b.points - a.points || b.completions - a.completions || a.name.localeCompare(b.name))
      .map((country, index) => ({ ...country, rank: index + 1 }))
  }, [displayNames, mode, users])

  const filteredCountries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale)
    if (!query) return countries
    return countries.filter(country => (
      country.name.toLocaleLowerCase(locale).includes(query)
      || country.code.toLocaleLowerCase(locale).includes(query)
      || country.players.some(player => getDisplayName(player).toLocaleLowerCase(locale).includes(query))
    ))
  }, [countries, locale, search])

  const selectedCountry = filteredCountries.find(country => country.code === selectedCode)
    || filteredCountries[0]
    || null

  const representedPlayers = countries.reduce((total, country) => total + country.players.length, 0)

  return (
    <PageShell className={styles.pageShell}>
      <div className={styles.worldGlow} aria-hidden="true" />

      <section className={styles.hero} aria-labelledby="country-ranking-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><Globe2 size={15} aria-hidden="true" /> {t('country.eyebrow')}</span>
          <h1 id="country-ranking-title">{t('country.title')} <span>{t('country.accent')}</span></h1>
          <p>{t('country.description')}</p>
          <div className={styles.modeSwitch} aria-label={t('country.chooseList')}>
            <button type="button" className={mode === 'main' ? styles.modeActive : ''} onClick={() => setMode('main')} aria-pressed={mode === 'main'}>
              {t('country.main')}
            </button>
            <button type="button" className={mode === 'community' ? styles.modeActive : ''} onClick={() => setMode('community')} aria-pressed={mode === 'community'}>
              {t('country.community')}
            </button>
          </div>
        </div>

        <div className={styles.heroStats} aria-label={t('country.summary')}>
          <div><MapPinned size={19} aria-hidden="true" /><strong>{loading ? '—' : countries.length}</strong><span>{t('country.rankedCountries')}</span></div>
          <div><Users size={19} aria-hidden="true" /><strong>{loading ? '—' : representedPlayers}</strong><span>{t('country.representedPlayers')}</span></div>
          <div className={styles.featuredStat}><Trophy size={19} aria-hidden="true" /><strong>{loading ? t('leaderboard.loading') : countries[0]?.name || t('leaderboard.unranked')}</strong><span>{t('country.leadingCountry')}</span></div>
        </div>
      </section>

      <section className={styles.workspace} aria-label={t('country.workspace')}>
        <aside className={styles.countryRail}>
          <div className={styles.railHeader}>
            <div>
              <span>{t('country.live')}</span>
              <h2>{t('country.countries')}</h2>
            </div>
            <span className={styles.resultCount}>{filteredCountries.length}</span>
          </div>
          <SearchBar value={search} onChange={setSearch} placeholder={t('country.search')} className={styles.search} />

          {loading ? (
            <div className={styles.loading}><Spinner size="lg" /></div>
          ) : loadError ? (
            <div className={styles.errorState} role="alert">
              <p>{t(loadError)}</p>
              <Button variant="secondary" size="sm" onClick={() => setRetryKey(key => key + 1)}>{t('leaderboard.tryAgain')}</Button>
            </div>
          ) : filteredCountries.length === 0 ? (
            <p className={styles.empty}>{t('country.noCountries')}</p>
          ) : (
            <div className={styles.countryList}>
              {filteredCountries.map((country, index) => (
                <motion.button
                  key={country.code}
                  type="button"
                  className={`${styles.countryButton} ${selectedCountry?.code === country.code ? styles.countrySelected : ''}`}
                  onClick={() => setSelectedCode(country.code)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index, 12) * 0.025 }}
                  aria-pressed={selectedCountry?.code === country.code}
                >
                  <span className={styles.countryRank}>#{country.rank}</span>
                  <img src={getFlagUrl(country.code, 40)} alt="" loading="lazy" />
                  <span className={styles.countryName}>{country.name}</span>
                  <span className={styles.countryPoints}>{formatNumber(country.points)}</span>
                  <ChevronRight size={15} aria-hidden="true" />
                </motion.button>
              ))}
            </div>
          )}
        </aside>

        <article className={styles.countryDetail} aria-live="polite">
          {selectedCountry ? (
            <>
              <header className={styles.countryHero}>
                <div className={styles.flagFrame}>
                  <img src={getFlagUrl(selectedCountry.code, 160)} alt={`${selectedCountry.name} flag`} />
                </div>
                <div>
                  <span className={styles.detailRank}>#{selectedCountry.rank} {mode === 'main' ? t('country.main') : t('country.community')}</span>
                  <h2>{selectedCountry.name}</h2>
                  <span className={styles.countryCode}>{selectedCountry.code}</span>
                </div>
              </header>

              <div className={styles.detailStats}>
                <div><Trophy size={18} aria-hidden="true" /><span>{t('country.totalPoints')}</span><strong>{formatNumber(selectedCountry.points)}</strong></div>
                <div><Users size={18} aria-hidden="true" /><span>{t('country.players')}</span><strong>{selectedCountry.players.length}</strong></div>
                <div><CheckCircle2 size={18} aria-hidden="true" /><span>{t('country.completions')}</span><strong>{formatNumber(selectedCountry.completions)}</strong></div>
              </div>

              <div className={styles.playerSection}>
                <div className={styles.playerHeading}>
                  <div><Medal size={17} aria-hidden="true" /><h3>{t('country.topPlayers')}</h3></div>
                  <span>{selectedCountry.players.length}</span>
                </div>
                <div className={styles.playerList}>
                  {selectedCountry.players.map((player, index) => (
                    <Link key={player.id} to={`/profile/${player.id}`} className={styles.playerRow}>
                      <span className={styles.playerRank}>#{index + 1}</span>
                      <Avatar src={player.avatarURL} alt={getDisplayName(player)} size="sm" />
                      <span className={styles.playerName}>{getDisplayName(player)}</span>
                      <span className={styles.playerCompletions}>{player._countryCompletions} {t('country.clears')}</span>
                      <strong>{formatNumber(player._countryPoints)}</strong>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : !loading && !loadError ? (
            <div className={styles.emptyDetail}><Globe2 size={32} aria-hidden="true" /><p>{t('country.noCountries')}</p></div>
          ) : null}
        </article>
      </section>
    </PageShell>
  )
}
