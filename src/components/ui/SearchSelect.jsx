import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown } from 'lucide-react'
import styles from './SearchSelect.module.css'

export default function SearchSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Search...',
  error,
  loading = false,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  const selected = options.find(o => o.value === value)

  const filtered = query
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase())
      )
    : options

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (val) => {
    onChange({ target: { value: val } })
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={`${styles.wrapper} ${className}`} ref={ref}>
      {label && <label className={styles.label}>{label}</label>}
      <div
        className={`${styles.trigger} ${open ? styles.open : ''} ${error ? styles.hasError : ''}`}
        onClick={() => { if (!loading) setOpen(!open) }}
      >
        {selected ? (
          <span className={styles.selected}>{selected.label}</span>
        ) : (
          <span className={styles.placeholder}>{loading ? 'Loading...' : placeholder}</span>
        )}
        <ChevronDown size={16} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.dropdown}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Type to search..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.options}>
              {loading ? (
                <div className={styles.emptyState}>Loading levels...</div>
              ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>No levels found</div>
              ) : (
                filtered.map(opt => (
                  <div
                    key={opt.value}
                    className={`${styles.option} ${opt.value === value ? styles.optionActive : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    {opt.label}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
