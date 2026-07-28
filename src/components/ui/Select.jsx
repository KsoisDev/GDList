import styles from './Select.module.css'

export default function Select({
  label,
  error,
  options,
  placeholder = 'Select...',
  className = '',
  ...props
}) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={`${styles.selectContainer} ${error ? styles.hasError : ''}`}>
        <select className={styles.select} {...props}>
          <option value="">{placeholder}</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
