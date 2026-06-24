/* src/shared/components/ProtectedRoute.jsx - Guards routes that require an authenticated user. */
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@shared/context/AuthContext'
import { PUBLIC_ROUTES_FOR_TESTING } from '@shared/lib/testingAccess'

export function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (PUBLIC_ROUTES_FOR_TESTING) {
    return children ?? <Outlet />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children ?? <Outlet />
}

export default ProtectedRoute
