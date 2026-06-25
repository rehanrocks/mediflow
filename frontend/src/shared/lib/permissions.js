/* src/shared/lib/permissions.js — DB-driven permission helpers.
   Reads from user.permissions dict (populated at login by the access_control module).
   Falls back to legacy role-based checks if permissions dict is not yet available. */
import { ROLES } from './roles'

function hasReadAccess(user, module) {
  const access = user?.permissions?.[module]
  if (access) return access === 'read' || access === 'both'
  return hasAuthenticatedRole(user)
}

function hasWriteAccess(user, module) {
  const access = user?.permissions?.[module]
  if (access) return access === 'write' || access === 'both'
  return hasAuthenticatedRole(user) && !isLegacyDoctor(user)
}

function hasAuthenticatedRole(user) {
  return Boolean(user?.role)
}

function getRoleSlug(user) {
  return user?.role_detail?.slug || user?.role
}

function isLegacyAdmin(user) {
  return getRoleSlug(user) === ROLES.ADMIN
}

function isLegacyReceptionist(user) {
  return getRoleSlug(user) === ROLES.RECEPTIONIST
}

function isLegacyDoctor(user) {
  return getRoleSlug(user) === ROLES.DOCTOR
}

export function getUserDoctorId(user) {
  return user?.user_id ?? user?.doctor_id ?? user?.id
}

export function isAdmin(user) {
  return isLegacyAdmin(user)
}

export function isDoctor(user) {
  return isLegacyDoctor(user)
}

export function isReceptionist(user) {
  return isLegacyReceptionist(user)
}

export function canViewPatients(user) {
  return hasReadAccess(user, 'patients')
}

export function canAddPatient(user) {
  return hasWriteAccess(user, 'patients')
}

export function canEditPatient(user) {
  return hasWriteAccess(user, 'patients')
}

export function canDeletePatient(user) {
  return isLegacyAdmin(user)
}

export function canViewAppointments(user) {
  return hasReadAccess(user, 'appointments')
}

export function canBookAppointment(user) {
  return hasWriteAccess(user, 'appointments')
}

export function canEditAppointment(user) {
  return hasWriteAccess(user, 'appointments')
}

export function canDeleteAppointment(user) {
  return isLegacyAdmin(user)
}

export function canChangeStatus(user) {
  return hasWriteAccess(user, 'appointments')
}

export function canChangePayment(user) {
  return hasWriteAccess(user, 'appointments')
}

export function canViewDoctors(user) {
  return hasReadAccess(user, 'doctors')
}

export function canAddDoctor(user) {
  return hasWriteAccess(user, 'doctors')
}

export function canEditDoctor(user) {
  return isLegacyAdmin(user)
}

export function canDeleteDoctor(user) {
  return isLegacyAdmin(user)
}

export function canViewStaff(user) {
  return hasReadAccess(user, 'staff')
}

export function canManageStaff(user) {
  return hasWriteAccess(user, 'staff')
}

export function isOwnDoctorProfile(user, doctorId) {
  const currentDoctorId = getUserDoctorId(user)

  return (
    isLegacyDoctor(user) &&
    currentDoctorId !== undefined &&
    String(currentDoctorId) === String(doctorId)
  )
}

export function canViewFullProfile(user, doctorId) {
  if (!user) return false
  return isLegacyAdmin(user) || isLegacyReceptionist(user) || isOwnDoctorProfile(user, doctorId)
}

export function canViewDoctorStats(user, doctorId) {
  return canViewFullProfile(user, doctorId)
}

export function canViewDoctorAppointments(user, doctorId) {
  return canViewFullProfile(user, doctorId)
}
