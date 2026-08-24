import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usesPasswordProvider } from '../../services/auth'
import RequireAuth from './RequireAuth'

function VerificationBoundary({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const needsVerification = usesPasswordProvider(user) && !user?.emailVerified

  if (needsVerification) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return (
      <Navigate
        to="/verify-email"
        replace
        state={{ from: location, returnTo }}
      />
    )
  }

  return children
}

export default function RequireVerifiedEmail({ children }) {
  return (
    <RequireAuth>
      <VerificationBoundary>{children}</VerificationBoundary>
    </RequireAuth>
  )
}
