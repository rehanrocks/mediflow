import { useCallback } from 'react'

import { useAuth } from '@shared/context/AuthContext'

const READ_VALUES = new Set(['read', 'both'])
const WRITE_VALUES = new Set(['write', 'both'])

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
      const access = permissions?.[module] ?? 'none'

      if (action === 'read') return READ_VALUES.has(access)
      if (action === 'write') return WRITE_VALUES.has(access)

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
      canRead('doctors') ||
      isOwnDoctorProfile(user, doctorId, role),
    [canRead, role, user],
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
