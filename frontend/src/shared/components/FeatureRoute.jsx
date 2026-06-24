/* src/shared/components/FeatureRoute.jsx - Guards routes behind organization feature flags and RBAC access. */
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@shared/context/AuthContext'
import { canViewDoctors, isAdmin, isDoctor } from '@shared/lib/permissions'
import { PUBLIC_ROUTES_FOR_TESTING } from '@shared/lib/testingAccess'

const ADMIN_ONLY_FEATURES = ['staff']
const DOCTOR_BLOCKED_FEATURES = ['staff']

export function FeatureRoute({ children, feature, featureKey }) {
  const { hasFeature, user } = useAuth()
  const location = useLocation()
  const resolvedFeatureKey = feature ?? featureKey

  if (!user && !PUBLIC_ROUTES_FOR_TESTING) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!user) {
    return children ?? <Outlet />
  }

  const roleBlocked =
    (resolvedFeatureKey &&
      ADMIN_ONLY_FEATURES.includes(resolvedFeatureKey) &&
      !isAdmin(user)) ||
    (resolvedFeatureKey === 'doctors' && !canViewDoctors(user)) ||
    (resolvedFeatureKey &&
      DOCTOR_BLOCKED_FEATURES.includes(resolvedFeatureKey) &&
      isDoctor(user) &&
      !ADMIN_ONLY_FEATURES.includes(resolvedFeatureKey))

  if (roleBlocked) {
    return (
      <Navigate
        to="/not-available"
        state={{ reason: 'role', featureKey: resolvedFeatureKey, from: location }}
        replace
      />
    )
  }

  if (resolvedFeatureKey && !hasFeature(resolvedFeatureKey)) {
    return (
      <Navigate
        to="/not-available"
        state={{ reason: 'feature', featureKey: resolvedFeatureKey, from: location }}
        replace
      />
    )
  }

  return children ?? <Outlet />
}

export default FeatureRoute
