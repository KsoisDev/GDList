import { COUNTRIES } from './countries'

const COUNTRY_STORAGE_KEY = 'basement-list-country-v1'
const validCountryCodes = new Set(COUNTRIES.map(country => country.code))

export function normalizeRepresentedCountry(value) {
  const code = String(value || '').trim().toUpperCase()
  return validCountryCodes.has(code) ? code : ''
}

export function getSavedRepresentedCountry() {
  if (typeof window === 'undefined') return ''
  return normalizeRepresentedCountry(window.localStorage.getItem(COUNTRY_STORAGE_KEY))
}

export function saveRepresentedCountry(value) {
  const code = normalizeRepresentedCountry(value)
  if (!code || typeof window === 'undefined') return false
  window.localStorage.setItem(COUNTRY_STORAGE_KEY, code)
  return true
}
