import { useCallback } from 'react'

import { useAuth } from '@shared/context/AuthContext'
import {
  canReadAccessLevel,
  canWriteAccessLevel,
  normalizeAccessLevel,
} from '@shared/lib/permissions'

export function getUserDoctorId(user) {
  return user?.user_id ?? user?.doctor_id ?? user?.id
}

export function isOwnDoctorProfile(user, doctorId, role) {
  const currentDoctorId = getUserDoctorId(user)

  return (
    role?.slug === 'doctor' &&
    currentDoctorId !== undefined &&
    String(currentDoctorId) === String(doctorId)
  )
}

export function usePermission() {
  const { permissions, role, user } = useAuth()

  const can = useCallback(
    (module, action) => {
      const access = normalizeAccessLevel(permissions?.[module])

      if (action === 'read') return canReadAccessLevel(access)
      if (action === 'write') return canWriteAccessLevel(access)

      return false
    },
    [permissions],
  )

  const canRead = useCallback((module) => can(module, 'read'), [can])
  const canWrite = useCallback((module) => can(module, 'write'), [can])
  const canDelete = useCallback(
    () => role?.slug === 'admin',
    [role],
  )
  const canViewFullDoctorProfile = useCallback(
    (doctorId) =>
      role?.slug === 'admin' ||
      role?.slug === 'receptionist' ||
      isOwnDoctorProfile(user, doctorId, role),
    [role, user],
  )
  const isOwnDoctor = useCallback(
    (doctorId) => isOwnDoctorProfile(user, doctorId, role),
    [role, user],
  )

  const isAdmin = role?.slug === 'admin'
  const isSystemRole = role?.is_system === true

  return {
    can,
    canRead,
    canWrite,
    canDelete,
    canViewFullDoctorProfile,
    isAdmin,
    isOwnDoctorProfile: isOwnDoctor,
    isSystemRole,
    role,
  }
}

export default usePermission
