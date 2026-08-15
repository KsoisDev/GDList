import { Search, X } from 'lucide-react'
import styles from './SearchBar.module.css'

export default function SearchBar({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      <Search className={styles.icon} size={18} />
      <input
        className={styles.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type="search"
      />
      {value && (
        <button
          className={styles.clear}
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}