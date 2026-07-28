import { forwardRef } from 'react'
import styles from './Input.module.css'

const Input = forwardRef(({
  label,
  error,
  icon: Icon,
  className = '',
  ...props
}, ref) => {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={`${styles.inputContainer} ${error ? styles.hasError : ''}`}>
        {Icon && <Icon className={styles.icon} size={18} />}
        <input ref={ref} className={styles.input} {...props} />
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
