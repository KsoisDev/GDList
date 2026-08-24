import { useId } from 'react'
import styles from './Select.module.css'

export default function Select({
  label,
  error,
  options,
  placeholder = 'Select...',
  className = '',
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}) {
  const generatedId = useId()
  const selectId = id || `select-${generatedId.replace(/:/g, '')}`
  const errorId = `${selectId}-error`
  const descriptionIds = [ariaDescribedBy, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && <label className={styles.label} htmlFor={selectId}>{label}</label>}
      <div className={`${styles.selectContainer} ${error ? styles.hasError : ''}`}>
        <select
          id={selectId}
          className={styles.select}
          aria-describedby={descriptionIds || undefined}
          aria-invalid={error ? true : ariaInvalid}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {error && <span id={errorId} className={styles.error} role="alert">{error}</span>}
    </div>
  )
}
