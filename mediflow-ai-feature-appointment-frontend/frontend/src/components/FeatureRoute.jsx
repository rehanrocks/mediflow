/* src/components/FeatureRoute.jsx - Guards routes behind organization feature flags. */
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export function FeatureRoute({ children, featureKey }) {
  const { hasFeature, user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!hasFeature(featureKey)) {
    return (
      <Navigate
        to="/not-available"
        state={{ featureKey, from: location }}
        replace
      />
    )
  }

  return children ?? <Outlet />
}

export default FeatureRoute
