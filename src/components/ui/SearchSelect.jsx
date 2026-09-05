import { useState, useRef, useEffect, useId } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, ChevronDown } from 'lucide-react'
import styles from './SearchSelect.module.css'

export default function SearchSelect({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Search...',
  error,
  loading = false,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const reduceMotion = useReducedMotion()
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const generatedId = useId().replace(/:/g, '')
  const triggerId = `search-select-${generatedId}`
  const listboxId = `${triggerId}-listbox`
  const errorId = `${triggerId}-error`

  const safeOptions = Array.isArray(options) ? options : []
  const optionLabel = (o) => String(o?.label ?? '')

  const selected = safeOptions.find(o => o?.value === value)

  const filtered = query
    ? safeOptions.filter(o =>
        optionLabel(o).toLowerCase().includes(query.toLowerCase())
      )
    : safeOptions

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!open || !filtered[activeIndex]) return
    ref.current
      ?.querySelector(`#${triggerId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, query, triggerId, filtered.length])

  const closeSelect = (restoreFocus = false) => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleSelect = (val) => {
    onChange({ target: { value: val } })
    closeSelect(true)
  }

  const openSelect = () => {
    if (loading) return
    setActiveIndex(Math.max(0, filtered.findIndex(option => option?.value === value)))
    setOpen(true)
  }

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSelect(true)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (filtered.length === 0) return
      setActiveIndex(index => Math.min(index + 1, filtered.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter' && filtered[activeIndex]) {
      event.preventDefault()
      handleSelect(filtered[activeIndex].value)
    }
  }

  return (
    <div
      className={`${styles.wrapper} ${className}`}
      ref={ref}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeSelect()
      }}
    >
      {label && <label className={styles.label} htmlFor={triggerId}>{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        className={`${styles.trigger} ${open ? styles.open : ''} ${error ? styles.hasError : ''}`}
        onClick={() => open ? closeSelect() : openSelect()}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openSelect()
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={loading}
      >
        {selected ? (
          <span className={styles.selected}>{selected.label}</span>
        ) : (
          <span className={styles.placeholder}>{loading ? 'Loading...' : placeholder}</span>
        )}
        <ChevronDown size={16} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.dropdown}
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
          >
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <input
                className={styles.searchInput}
                placeholder="Type to search..."
                value={query}
                onChange={event => { setQuery(event.target.value); setActiveIndex(0) }}
                onKeyDown={handleSearchKeyDown}
                role="combobox"
                aria-label={`Search ${label || 'options'}`}
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-activedescendant={filtered[activeIndex] ? `${triggerId}-option-${activeIndex}` : undefined}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className={styles.options} id={listboxId} role="listbox" aria-label={label || 'Options'}>
              {loading ? (
                <div className={styles.emptyState}>Loading levels...</div>
              ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>No levels found</div>
              ) : (
                filtered.map((opt, index) => (
                  <button
                    type="button"
                    tabIndex={-1}
                    key={opt?.value ?? index}
                    id={`${triggerId}-option-${index}`}
                    role="option"
                    aria-selected={opt?.value === value}
                    className={`${styles.option} ${opt?.value === value ? styles.optionActive : ''} ${index === activeIndex ? styles.optionFocused : ''}`}
                    onClick={() => handleSelect(opt?.value)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {optionLabel(opt)}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <span id={errorId} className={styles.error} role="alert">{error}</span>}
    </div>
  )
}
