import { Search, X } from 'lucide-react'
import styles from './SearchBar.module.css'

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  ariaLabel,
  className = '',
}) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      <Search className={styles.icon} size={18} aria-hidden="true" />
      <input
        className={styles.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type="search"
        aria-label={ariaLabel || placeholder}
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
