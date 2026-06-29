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
import { useNavigate } from 'react-router-dom'

import { normalizeAccessLevel } from '@shared/lib/permissions'
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
const PERMISSION_MODULES = ['appointments', 'doctors', 'patients', 'reports', 'staff']

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
    return Object.entries(permissions).reduce((nextPermissions, [module, access]) => {
      nextPermissions[module] = normalizeAccessLevel(access)
      return nextPermissions
    }, {})
  }

  if (Array.isArray(user.enabled_features)) {
    return {
      appointments: user.enabled_features.includes('appointments') ? 'read' : 'no_access',
      doctors: user.enabled_features.includes('doctors') ? 'read' : 'no_access',
      patients: user.enabled_features.includes('patients') ? 'read' : 'no_access',
      reports: user.enabled_features.includes('reports') ? 'read' : 'no_access',
      staff: user.enabled_features.includes('staff') ? 'read' : 'no_access',
    }
  }

  return PERMISSION_MODULES.reduce((nextPermissions, module) => {
    nextPermissions[module] = 'no_access'
    return nextPermissions
  }, {})
}

function normalizeUser(responseUser = {}, fallbackUser = {}) {
  const profile = { ...fallbackUser, ...responseUser }

  delete profile.access
  delete profile.access_token
  delete profile.enabled_features
  delete profile.permissions
  delete profile.refresh
  delete profile.refresh_token
  delete profile.role

  return profile
}

function normalizeSessionPayload(response = {}, fallbackUser = {}) {
  const responseUser = response.user || response
  const forcePasswordChange = Boolean(
    response.force_password_change ?? responseUser.force_password_change,
  )
  const user = {
    ...normalizeUser(responseUser, fallbackUser),
    force_password_change: forcePasswordChange,
  }
  const role = normalizeRole(
    response.role_detail || response.role,
    responseUser,
  )
  const permissions = normalizePermissions(
    response.permissions || responseUser.permissions,
    responseUser,
  )

  return {
    accessToken: response.access_token ?? response.access ?? '',
    permissions,
    refreshToken: response.refresh_token ?? response.refresh,
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
  const storedPermissions = readStorageJson('permissions')
  const permissions = storedPermissions
    ? normalizePermissions(storedPermissions, user || {})
    : normalizePermissions(null, user || {})

  if (!user) {
    return getPublicTestingSession()
  }

  return { permissions, role, user }
}

function getStoredRefreshToken() {
  return localStorage.getItem('refresh_token') || localStorage.getItem('refresh') || ''
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
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

  const homePath = useCallback((targetRole = roleRef.current) => {
    if (!targetRole) {
      return PUBLIC_ROUTES_FOR_TESTING ? '/dashboard/general' : '/login'
    }

    if (targetRole.slug === 'doctor') {
      return '/dashboard/doctor'
    }

    return '/dashboard/general'
  }, [])

  const login = useCallback(async (email, password) => {
    const response = await loginRequest(email, password)
    const authenticatedSession = normalizeSessionPayload(response, {
      email: String(email || '').trim(),
    })

    applySession(authenticatedSession)

    navigate(
      authenticatedSession.user.force_password_change
        ? '/change-password'
        : homePath(authenticatedSession.role),
      { replace: true },
    )

    return authenticatedSession
  }, [applySession, homePath, navigate])

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
    const nextSession = normalizeSessionPayload(response, userRef.current || {})

    applySession({
      accessToken: nextSession.accessToken,
      permissions: nextSession.permissions,
      role: nextSession.role,
      user: nextSession.user,
    })

    if (nextSession.user.force_password_change) {
      navigate('/change-password', { replace: true })
    }

    return nextSession
  }, [applySession, navigate])

  const logout = useCallback(() => {
    clearStoredSession()

    const testingSession = getPublicTestingSession()

    userRef.current = testingSession?.user || null
    roleRef.current = testingSession?.role || null
    setUser(testingSession?.user || null)
    setRole(testingSession?.role || null)
    setPermissions(testingSession?.permissions || normalizePermissions())
  }, [])

  const markPasswordChangeComplete = useCallback(() => {
    const nextUser = {
      ...(userRef.current || {}),
      force_password_change: false,
    }

    applySession({ user: nextUser })
    return nextUser
  }, [applySession])

  useEffect(() => {
    configureAuthSync({
      getRefreshToken: getStoredRefreshToken,
      onSessionExpired: logout,
      onSessionSync: (response) => {
        const nextSession = normalizeSessionPayload(response, userRef.current || {})
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

    let consecutiveFailures = 0

    async function pollPermissions() {
      try {
        await refreshSession()
        consecutiveFailures = 0
      } catch {
        consecutiveFailures += 1
        if (consecutiveFailures >= 3) {
          console.warn('Permission refresh failed 3 consecutive times; session may be stale.')
        }
      }
    }

    const interval = window.setInterval(pollPermissions, REFRESH_SYNC_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [refreshSession])

  const value = useMemo(
    () => ({
      homePath,
      login,
      logout,
      markPasswordChangeComplete,
      permissions,
      refreshSession,
      role,
      user,
    }),
    [
      homePath,
      login,
      logout,
      markPasswordChangeComplete,
      permissions,
      refreshSession,
      role,
      user,
    ],
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
