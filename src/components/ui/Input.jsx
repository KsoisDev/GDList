import { forwardRef, useId } from 'react'
import styles from './Input.module.css'

const Input = forwardRef(({
  label,
  error,
  icon: Icon,
  className = '',
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}, ref) => {
  const generatedId = useId()
  const inputId = id || `input-${generatedId.replace(/:/g, '')}`
  const errorId = `${inputId}-error`
  const descriptionIds = [ariaDescribedBy, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && <label className={styles.label} htmlFor={inputId}>{label}</label>}
      <div className={`${styles.inputContainer} ${error ? styles.hasError : ''}`}>
        {Icon && <Icon className={styles.icon} size={18} aria-hidden="true" />}
        <input
          ref={ref}
          id={inputId}
          className={styles.input}
          aria-describedby={descriptionIds || undefined}
          aria-invalid={error ? true : ariaInvalid}
          {...props}
        />
      </div>
      {error && <span id={errorId} className={styles.error} role="alert">{error}</span>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
