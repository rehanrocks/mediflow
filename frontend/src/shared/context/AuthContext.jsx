/* eslint-disable react-refresh/only-export-components -- src/shared/context/AuthContext.jsx - Provides authentication state and permission session data. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  getPublicTestingSession,
  PUBLIC_ROUTES_FOR_TESTING,
} from '@shared/lib/testingAccess'
import {
  configureAuthSync,
  login as loginRequest,
  refreshToken as refreshTokenRequest,
} from '@shared/services/api'

const AuthContext = createContext(null)
const REFRESH_SYNC_INTERVAL_MS = 60_000

function readStorageJson(key) {
  const stored = localStorage.getItem(key)

  if (!stored) {
    return null
  }

  try {
    return JSON.parse(stored)
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function normalizeRole(role, user = {}) {
  if (role && typeof role === 'object') {
    return role
  }

  const slug = String(role || user.role || '').trim()

  if (!slug) {
    return null
  }

  return {
    id: user.role_id ?? null,
    is_system: ['admin', 'doctor', 'receptionist'].includes(slug),
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    slug,
  }
}

function normalizePermissions(permissions, user = {}) {
  if (permissions && typeof permissions === 'object') {
    return permissions
  }

  if (Array.isArray(user.enabled_features)) {
    return {
      appointments: user.enabled_features.includes('appointments') ? 'both' : 'none',
      doctors: user.enabled_features.includes('doctors') ? 'both' : 'none',
      patients: user.enabled_features.includes('patients') ? 'both' : 'none',
      reports: user.enabled_features.includes('reports') ? 'read' : 'none',
      staff: user.enabled_features.includes('staff') ? 'both' : 'none',
    }
  }

  return {
    appointments: 'none',
    doctors: 'none',
    patients: 'none',
    reports: 'none',
    staff: 'none',
  }
}

function normalizeUser(responseUser = {}) {
  const profile = { ...responseUser }

  delete profile.role
  delete profile.enabled_features

  return profile
}

function normalizeSessionPayload(response = {}) {
  const responseUser = response.user || response
  const user = normalizeUser(responseUser)
  const role = normalizeRole(response.role, responseUser)
  const permissions = normalizePermissions(response.permissions, responseUser)

  return {
    accessToken: response.access_token ?? response.access ?? '',
    permissions,
    refreshToken: response.refresh_token ?? response.refresh ?? '',
    role,
    user,
  }
}

function persistSession({ accessToken, permissions, refreshToken, role, user }) {
  if (accessToken !== undefined) {
    localStorage.setItem('access_token', accessToken || '')
    localStorage.removeItem('access')
  }

  if (refreshToken !== undefined) {
    localStorage.setItem('refresh_token', refreshToken || '')
    localStorage.removeItem('refresh')
  }

  if (user !== undefined) {
    localStorage.setItem('user', JSON.stringify(user))
  }

  if (role !== undefined) {
    localStorage.setItem('role', JSON.stringify(role))
  }

  if (permissions !== undefined) {
    localStorage.setItem('permissions', JSON.stringify(permissions))
  }
}

function clearStoredSession() {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('permissions')
  localStorage.removeItem('role')
  localStorage.removeItem('user')
}

function getInitialSession() {
  if (PUBLIC_ROUTES_FOR_TESTING) {
    return getPublicTestingSession()
  }

  const user = readStorageJson('user')
  const role = readStorageJson('role') || normalizeRole(null, user || {})
  const permissions = readStorageJson('permissions') || normalizePermissions(null, user || {})

  if (!user) {
    return getPublicTestingSession()
  }

  return { permissions, role, user }
}

function getStoredRefreshToken() {
  return localStorage.getItem('refresh_token') || localStorage.getItem('refresh') || ''
}

export function AuthProvider({ children }) {
  const initialSession = getInitialSession()
  const [user, setUser] = useState(initialSession?.user || null)
  const [role, setRole] = useState(initialSession?.role || null)
  const [permissions, setPermissions] = useState(
    initialSession?.permissions || normalizePermissions(),
  )
  const userRef = useRef(user)
  const roleRef = useRef(role)

  const applySession = useCallback((session, { persist = true } = {}) => {
    const nextUser = session.user ?? userRef.current
    const nextRole = session.role ?? roleRef.current
    const nextPermissions = session.permissions ?? permissions

    if (session.accessToken !== undefined || session.refreshToken !== undefined || persist) {
      persistSession({
        accessToken: session.accessToken,
        permissions: nextPermissions,
        refreshToken: session.refreshToken,
        role: nextRole,
        user: nextUser,
      })
    }

    userRef.current = nextUser
    roleRef.current = nextRole
    setUser(nextUser)
    setRole(nextRole)
    setPermissions(nextPermissions)
  }, [permissions])

  const login = useCallback(async (email, password) => {
    const response = await loginRequest(email, password)
    const authenticatedSession = normalizeSessionPayload(response)

    applySession(authenticatedSession)

    return authenticatedSession
  }, [applySession])

  const refreshSession = useCallback(async () => {
    if (PUBLIC_ROUTES_FOR_TESTING) {
      const testingSession = getPublicTestingSession()
      applySession(testingSession, { persist: false })
      return testingSession
    }

    const storedRefreshToken = getStoredRefreshToken()

    if (!storedRefreshToken) {
      return null
    }

    const response = await refreshTokenRequest(storedRefreshToken)
    const nextSession = normalizeSessionPayload(response)

    applySession({
      accessToken: nextSession.accessToken,
      permissions: nextSession.permissions,
      role: nextSession.role,
    })

    return nextSession
  }, [applySession])

  const logout = useCallback(() => {
    clearStoredSession()

    const testingSession = getPublicTestingSession()

    userRef.current = testingSession?.user || null
    roleRef.current = testingSession?.role || null
    setUser(testingSession?.user || null)
    setRole(testingSession?.role || null)
    setPermissions(testingSession?.permissions || normalizePermissions())
  }, [])

  const homePath = useCallback((targetRole = roleRef.current) => {
    if (!targetRole) {
      return PUBLIC_ROUTES_FOR_TESTING ? '/dashboard/general' : '/login'
    }

    if (targetRole.slug === 'doctor') {
      return '/dashboard/doctor'
    }

    return '/dashboard/general'
  }, [])

  useEffect(() => {
    configureAuthSync({
      getRefreshToken: getStoredRefreshToken,
      onSessionExpired: logout,
      onSessionSync: (response) => {
        const nextSession = normalizeSessionPayload(response)
        applySession({
          accessToken: nextSession.accessToken,
          permissions: nextSession.permissions,
          role: nextSession.role,
        })
      },
    })
  }, [applySession, logout])

  useEffect(() => {
    if (PUBLIC_ROUTES_FOR_TESTING || !getStoredRefreshToken()) {
      return undefined
    }

    const interval = window.setInterval(() => {
      refreshSession().catch(() => {
        // The next guarded request will surface auth problems; avoid noisy polling failures.
      })
    }, REFRESH_SYNC_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [refreshSession])

  const value = useMemo(
    () => ({
      homePath,
      login,
      logout,
      permissions,
      refreshSession,
      role,
      user,
    }),
    [homePath, login, logout, permissions, refreshSession, role, user],
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
