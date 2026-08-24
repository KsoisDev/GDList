import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { hasAccess } from '../../utils/constants'
import RequireAuth from './RequireAuth'

function RoleBoundary({ children, minRole, deniedTo }) {
  const { userData } = useAuth()
  const location = useLocation()

  if (!hasAccess(userData?.role || 'user', minRole)) {
    return (
      <Navigate
        to={deniedTo}
        replace
        state={{
          accessDenied: true,
          requiredRole: minRole,
          from: location,
        }}
      />
    )
  }

  return children
}

export default function RequireRole({ children, minRole = 'admin', deniedTo = '/' }) {
  return (
    <RequireAuth>
      <RoleBoundary minRole={minRole} deniedTo={deniedTo}>
        {children}
      </RoleBoundary>
    </RequireAuth>
  )
}
