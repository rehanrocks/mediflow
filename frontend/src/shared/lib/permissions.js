/* src/shared/lib/permissions.js - Central RBAC helpers for MediFlow portal roles. */
import { ROLES } from './roles'

function hasAuthenticatedRole(user) {
  return Boolean(user?.role)
}

export function getUserDoctorId(user) {
  return user?.user_id ?? user?.doctor_id ?? user?.id
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN
}

export function isDoctor(user) {
  return user?.role === ROLES.DOCTOR
}

export function isReceptionist(user) {
  return user?.role === ROLES.RECEPTIONIST
}

export function canViewPatients(user) {
  return hasAuthenticatedRole(user)
}

export function canAddPatient(user) {
  return hasAuthenticatedRole(user) && !isDoctor(user)
}

export function canEditPatient(user) {
  return hasAuthenticatedRole(user) && !isDoctor(user)
}

export function canDeletePatient(user) {
  return isAdmin(user)
}

export function canViewAppointments(user) {
  return hasAuthenticatedRole(user)
}

export function canBookAppointment(user) {
  return hasAuthenticatedRole(user) && !isDoctor(user)
}

export function canEditAppointment(user) {
  return hasAuthenticatedRole(user) && !isDoctor(user)
}

export function canDeleteAppointment(user) {
  return isAdmin(user)
}

export function canChangeStatus(user) {
  return hasAuthenticatedRole(user) && !isDoctor(user)
}

export function canChangePayment(user) {
  return hasAuthenticatedRole(user) && !isDoctor(user)
}

export function canViewDoctors(user) {
  return isAdmin(user) || isReceptionist(user)
}

export function canAddDoctor(user) {
  return isAdmin(user) || isReceptionist(user)
}

export function canEditDoctor(user) {
  return isAdmin(user)
}

export function canDeleteDoctor(user) {
  return isAdmin(user)
}

export function canViewStaff(user) {
  return isAdmin(user)
}

export function canManageStaff(user) {
  return isAdmin(user)
}

export function isOwnDoctorProfile(user, doctorId) {
  const currentDoctorId = getUserDoctorId(user)

  return (
    isDoctor(user) &&
    currentDoctorId !== undefined &&
    String(currentDoctorId) === String(doctorId)
  )
}

export function canViewFullProfile(user, doctorId) {
  if (!user) return false
  return isAdmin(user) || isReceptionist(user) || isOwnDoctorProfile(user, doctorId)
}

export function canViewDoctorStats(user, doctorId) {
  return canViewFullProfile(user, doctorId)
}

export function canViewDoctorAppointments(user, doctorId) {
  return canViewFullProfile(user, doctorId)
}
