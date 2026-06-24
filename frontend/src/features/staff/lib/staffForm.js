/* src/features/staff/lib/staffForm.js - Staff form validation and payload mapping. */
import { validatePhone } from '@shared/lib/validation'
import {
  STAFF_MAX_AGE,
  STAFF_MIN_AGE,
  getStaffAgeError,
  getStaffJoiningDateError,
} from '@shared/lib/staffUtils'

export const INITIAL_STAFF_FORM_DATA = {
  full_name: '',
  age: '',
  phone: '',
  address: '',
  role: '',
  status: 'active',
  joining_date: new Date().toISOString().split('T')[0],
  shift_start: '09:00',
  shift_end: '17:00',
  notes: '',
}

export const TOUCHED_ALL_STAFF_FIELDS = {
  address: true,
  age: true,
  full_name: true,
  joining_date: true,
  notes: true,
  phone: true,
  role: true,
  shift_end: true,
  shift_start: true,
  status: true,
}

export function validateStaffForm(data) {
  const errors = {}
  const phoneError = validatePhone(data.phone)

  if (String(data.full_name || '').trim().length < 2) {
    errors.full_name = 'Name must be at least 2 characters'
  }

  const ageError = getStaffAgeError(data.age)

  if (ageError) {
    errors.age = ageError
  }

  if (phoneError) {
    errors.phone = phoneError
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

  return errors
}

export function mapStaffToForm(staffMember) {
  return {
    full_name: staffMember.full_name || '',
    age: staffMember.age ?? '',
    phone: staffMember.phone || '',
    address: staffMember.address || '',
    role: staffMember.role || '',
    status: staffMember.status || 'active',
    joining_date: staffMember.joining_date || '',
    shift_start: staffMember.shift_start || '09:00',
    shift_end: staffMember.shift_end || '17:00',
    notes: staffMember.notes || '',
  }
}

export function prepareStaffPayload(data) {
  return {
    full_name: String(data.full_name || '').trim(),
    age: Math.min(
      STAFF_MAX_AGE,
      Math.max(STAFF_MIN_AGE, Number.parseInt(data.age, 10)),
    ),
    phone: String(data.phone || '').trim(),
    address: String(data.address || '').trim() || null,
    role: String(data.role || '').trim(),
    status: data.status,
    joining_date: data.joining_date,
    shift_start: data.shift_start,
    shift_end: data.shift_end,
    notes: String(data.notes || '').trim() || null,
  }
}
