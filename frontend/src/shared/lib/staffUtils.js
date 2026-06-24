/* src/shared/lib/staffUtils.js - Utility functions for staff records. */

const DAY_MS = 1000 * 60 * 60 * 24
const YEAR_DAYS = 365.25

export const STAFF_MIN_AGE = 18
export const STAFF_MAX_AGE = 60

function startOfDay(date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function parseDate(value) {
  if (!value) return null

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

export function getStaffAgeError(ageValue) {
  const age = Number.parseInt(ageValue, 10)

  if (!Number.isInteger(age) || age < STAFF_MIN_AGE || age > STAFF_MAX_AGE) {
    return `Age must be between ${STAFF_MIN_AGE} and ${STAFF_MAX_AGE}`
  }

  return ''
}

export function getStaffJoiningDateError(ageValue, joiningDateString) {
  const ageError = getStaffAgeError(ageValue)
  const joined = parseDate(joiningDateString)
  const today = startOfDay(new Date())

  if (!joiningDateString) {
    return 'Joining date is required'
  }

  if (!joined) {
    return 'Enter a valid joining date'
  }

  if (startOfDay(joined) > today) {
    return 'Joining date cannot be in the future'
  }

  if (ageError) {
    return ''
  }

  const age = Number.parseInt(ageValue, 10)
  const tenureYears = (today - startOfDay(joined)) / (DAY_MS * YEAR_DAYS)

  if (tenureYears > age - (STAFF_MIN_AGE - 1)) {
    return 'Joining date is not consistent with age'
  }

  return ''
}

export function getStaffCreatedDateError(joiningDateString, createdAtString) {
  const joined = parseDate(joiningDateString)
  const created = parseDate(createdAtString)

  if (!joined || !created) {
    return ''
  }

  if (startOfDay(joined) > startOfDay(created)) {
    return 'Joining date cannot be after the date added to system'
  }

  return ''
}

export function getStaffDataIssues(staffMember) {
  const ageError = getStaffAgeError(staffMember?.age)
  const joiningError = getStaffJoiningDateError(
    staffMember?.age,
    staffMember?.joining_date,
  )
  const createdError = getStaffCreatedDateError(
    staffMember?.joining_date,
    staffMember?.created_at,
  )

  return [ageError, joiningError, createdError].filter(Boolean)
}

export function computeTenure(joiningDateString) {
  const joined = new Date(joiningDateString)

  if (!joiningDateString || Number.isNaN(joined.getTime())) {
    return ''
  }

  const now = new Date()
  const days = Math.max(0, Math.floor((now - joined) / DAY_MS))
  const years = Math.floor(days / 365)
  const months = Math.floor(days / 30) % 12

  if (years >= 1) {
    return [
      `${years} yr${years > 1 ? 's' : ''}`,
      months > 0 ? `${months} mo` : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (months >= 1) {
    return `${months} month${months > 1 ? 's' : ''}`
  }

  return `${days} day${days !== 1 ? 's' : ''}`
}

export function extractUniqueRoles(staffArray) {
  if (!Array.isArray(staffArray)) {
    return []
  }

  return [...new Set(staffArray.map((staff) => staff.role).filter(Boolean))].sort()
}
