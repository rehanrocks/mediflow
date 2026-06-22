/* eslint-disable react-refresh/only-export-components -- src/context/AuthContext.jsx - Provides authentication state and feature helpers. */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

import { login as loginRequest } from '../services/api'

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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)

  const login = useCallback(async (username, password) => {
    const response = await loginRequest({ username, password })
    const authenticatedUser = {
      id: response.id,
      role: response.role,
      first_name: response.first_name,
      last_name: response.last_name,
      organization_id: response.organization_id,
      organization_name: response.organization_name,
      enabled_features: response.enabled_features,
    }

    localStorage.setItem('access', response.access)
    localStorage.setItem('refresh', response.refresh)
    localStorage.setItem('user', JSON.stringify(authenticatedUser))
    setUser(authenticatedUser)

    return authenticatedUser
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const hasFeature = useCallback(
    (key) => Array.isArray(user?.enabled_features) && user.enabled_features.includes(key),
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      hasFeature,
    }),
    [hasFeature, login, logout, user],
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
