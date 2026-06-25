/* eslint-disable react-refresh/only-export-components -- src/shared/context/AuthContext.jsx - Provides authentication state and feature helpers. */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

import { ROLES } from '@shared/lib/roles'
import {
  getPublicTestingUser,
  PUBLIC_ROUTES_FOR_TESTING,
} from '@shared/lib/testingAccess'
import { login as loginRequest } from '@shared/services/api'

const AuthContext = createContext(null)

function getStoredUser() {
  const storedUser = localStorage.getItem('user')

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser)
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

function getInitialUser() {
  return getStoredUser() || getPublicTestingUser()
}

function normalizeAuthenticatedUser(responseUser = {}) {
  return {
    id: responseUser.id,
    email: responseUser.email,
    full_name: responseUser.full_name,
    role: responseUser.role,
    first_name: responseUser.first_name,
    last_name: responseUser.last_name,
    organization_id: responseUser.organization_id,
    organization_name: responseUser.organization_name,
    enabled_features: responseUser.enabled_features,
    user_id: responseUser.user_id,
    doctor_id: responseUser.doctor_id,
    permissions: responseUser.permissions || {},
    role_detail: responseUser.role_detail || {},
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getInitialUser)
  const userRef = useRef(user)

  const login = useCallback(async (email, password) => {
    const response = await loginRequest(email, password)
    const responseUser = response?.user
      ? {
          ...response.user,
          enabled_features:
            response.user.enabled_features ?? response.enabled_features,
          organization_id:
            response.user.organization_id ?? response.organization_id,
          organization_name:
            response.user.organization_name ?? response.organization_name,
          permissions:
            response.user.permissions ?? response.permissions,
          role_detail:
            response.user.role_detail ?? response.role_detail,
        }
      : { ...response, permissions: response.permissions, role_detail: response.role_detail }
    const authenticatedUser = normalizeAuthenticatedUser(responseUser)
    const accessToken = response?.access_token ?? response?.access
    const refreshToken = response?.refresh_token ?? response?.refresh

    localStorage.setItem('access_token', accessToken || '')
    localStorage.setItem('refresh_token', refreshToken || '')
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.setItem('user', JSON.stringify(authenticatedUser))

    userRef.current = authenticatedUser
    setUser(authenticatedUser)

    return authenticatedUser
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    const testingUser = getPublicTestingUser()
    userRef.current = testingUser
    setUser(testingUser)
  }, [])

  const hasFeature = useCallback(
    (key) =>
      PUBLIC_ROUTES_FOR_TESTING ||
      (Array.isArray(user?.enabled_features) && user.enabled_features.includes(key)),
    [user],
  )

  const can = useCallback((permissionFn) => {
    return user ? permissionFn(user) : false
  }, [user])

  const homePath = useCallback(() => {
    const currentUser = userRef.current

    if (!currentUser) {
      return PUBLIC_ROUTES_FOR_TESTING ? '/dashboard/admin' : '/login'
    }

    if (currentUser.role === ROLES.DOCTOR) {
      return '/dashboard/doctor'
    }

    if (currentUser.role === ROLES.RECEPTIONIST) {
      return '/dashboard/admin'
    }

    return '/dashboard/admin'
  }, [])

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      hasFeature,
      can,
      homePath,
      permissions: user?.permissions || {},
      role: user?.role_detail || { slug: user?.role, is_system: true },
    }),
    [can, hasFeature, homePath, login, logout, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

export default AuthProvider
