/* src/features/staff/lib/staffForm.js - Staff form validation and payload mapping. */
import { validateEmail, validatePhone } from '@shared/lib/validation'
import {
  STAFF_MAX_AGE,
  STAFF_MIN_AGE,
  getStaffAgeError,
  getStaffJoiningDateError,
} from '@shared/lib/staffUtils'

function capitalizeWords(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export const INITIAL_STAFF_FORM_DATA = {
  full_name: '',
  age: '',
  phone: '',
  email: '',
  address: '',
  role: '',
  status: 'active',
  joining_date: new Date().toISOString().split('T')[0],
  shift_start: '09:00',
  shift_end: '17:00',
  notes: '',
  first_name: '',
  last_name: '',
  qualification: '',
  specializations: [],
  experience_years: '',
  doctor_status: 'active',
}

export const TOUCHED_ALL_STAFF_FIELDS = {
  address: true,
  age: true,
  email: true,
  full_name: true,
  joining_date: true,
  notes: true,
  phone: true,
  role: true,
  shift_end: true,
  shift_start: true,
  status: true,
  first_name: true,
  last_name: true,
  qualification: true,
  specializations: true,
  experience_years: true,
  doctor_status: true,
}

export function validateStaffForm(data) {
  const errors = {}
  const emailError = validateEmail(data.email)
  const phoneError = validatePhone(data.phone)
  const roleLower = String(data.role || '').trim().toLowerCase()

  if (roleLower !== 'doctor') {
    if (String(data.full_name || '').trim().length < 2) {
      errors.full_name = 'Name must be at least 2 characters'
    }
  }

  const ageError = getStaffAgeError(data.age)

  if (ageError) {
    errors.age = ageError
  }

  if (phoneError) {
    errors.phone = phoneError
  }

  if (emailError) {
    errors.email = emailError
  }

  const role = String(data.role || '').trim()

  if (!role) {
    errors.role = 'Role is required'
  } else if (role.length < 2) {
    errors.role = 'Role must be at least 2 characters'
  }

  if (!['active', 'inactive'].includes(data.status)) {
    errors.status = 'Choose a valid status'
  }

  const joiningDateError = getStaffJoiningDateError(data.age, data.joining_date)

  if (joiningDateError) {
    errors.joining_date = joiningDateError
  }

  if (!data.shift_start) {
    errors.shift_start = 'Shift start time is required'
  }

  if (!data.shift_end) {
    errors.shift_end = 'Shift end time is required'
  }

  if (data.shift_start && data.shift_end && data.shift_end === data.shift_start) {
    errors.shift_end = 'End time must be different from start time'
  }

  if (roleLower === 'doctor') {
    const firstName = String(data.first_name || '').trim()
    const lastName = String(data.last_name || '').trim()

    if (firstName.length < 2) {
      errors.first_name = 'First name must be at least 2 characters'
    }
    if (lastName.length < 2) {
      errors.last_name = 'Last name must be at least 2 characters'
    }

    const specializations = Array.isArray(data.specializations)
      ? data.specializations.filter(Boolean)
      : []
    if (specializations.length === 0) {
      errors.specializations = 'At least one specialization is required'
    }

    const expYears = Number.parseInt(data.experience_years, 10)
    if (Number.isNaN(expYears) || expYears < 0) {
      errors.experience_years = 'Experience years must be 0 or greater'
    } else if (expYears > 60) {
      errors.experience_years = 'Experience years cannot exceed 60'
    }

    if (!['active', 'on_leave', 'inactive'].includes(data.doctor_status)) {
      errors.doctor_status = 'Choose a valid status'
    }
  }

  return errors
}

export function mapStaffToForm(staffMember) {
  return {
    full_name: staffMember.full_name || '',
    age: staffMember.age ?? '',
    phone: staffMember.phone || '',
    email: staffMember.email || '',
    has_account: staffMember.has_account === true,
    address: staffMember.address || '',
    role: staffMember.role || '',
    status: staffMember.status || 'active',
    joining_date: staffMember.joining_date || '',
    shift_start: staffMember.shift_start || '09:00',
    shift_end: staffMember.shift_end || '17:00',
    notes: staffMember.notes || '',
    first_name: staffMember.first_name || '',
    last_name: staffMember.last_name || '',
    qualification: staffMember.qualification || '',
    specializations: Array.isArray(staffMember.specializations)
      ? staffMember.specializations
      : [],
    experience_years: staffMember.experience_years ?? '',
    doctor_status: staffMember.status || 'active',
  }
}

export function prepareStaffPayload(data) {
  const roleLower = String(data.role || '').trim().toLowerCase()

  const fullName = roleLower === 'doctor'
    ? capitalizeWords(
        `${String(data.first_name || '').trim()} ${String(data.last_name || '').trim()}`,
      )
    : String(data.full_name || '').trim()

  const payload = {
    full_name: fullName,
    age: Math.min(
      STAFF_MAX_AGE,
      Math.max(STAFF_MIN_AGE, Number.parseInt(data.age, 10)),
    ),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim(),
    address: String(data.address || '').trim() || null,
    role: String(data.role || '').trim(),
    status: data.status,
    joining_date: data.joining_date,
    shift_start: data.shift_start,
    shift_end: data.shift_end,
    notes: String(data.notes || '').trim() || null,
  }

  if (roleLower === 'doctor') {
    payload.first_name = capitalizeWords(String(data.first_name || '').trim())
    payload.last_name = capitalizeWords(String(data.last_name || '').trim())
    payload.qualification = String(data.qualification || '').trim()
    payload.specializations = Array.isArray(data.specializations)
      ? data.specializations.filter(Boolean)
      : []
    payload.experience_years = Number.parseInt(data.experience_years, 10) || 0
    payload.status = data.doctor_status || 'active'
  }

  return payload
}
