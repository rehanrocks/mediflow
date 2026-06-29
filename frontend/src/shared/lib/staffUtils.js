/* src/shared/lib/staffUtils.js - Utility functions for staff records. */

export const STAFF_MIN_AGE = 18
export const STAFF_MAX_AGE = 60

function parseDate(value) {
  if (!value) return null

  const parts = String(value).split('-')

  if (parts.length === 3) {
    const year = Number(parts[0])
    const month = Number(parts[1])
    const day = Number(parts[2])

    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const date = new Date(year, month - 1, day)

      if (!Number.isNaN(date.getTime())) {
        return date
      }
    }
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function isAfterToday(date) {
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDay = today.getDate()

  const joinYear = date.getFullYear()
  const joinMonth = date.getMonth()
  const joinDay = date.getDate()

  if (joinYear > todayYear) return true
  if (joinYear < todayYear) return false
  if (joinMonth > todayMonth) return true
  if (joinMonth < todayMonth) return false
  return joinDay > todayDay
}

export function getStaffAgeError(ageValue) {
  const age = Number.parseInt(ageValue, 10)

  if (!Number.isInteger(age) || age < STAFF_MIN_AGE || age > STAFF_MAX_AGE) {
    return `Age must be between ${STAFF_MIN_AGE} and ${STAFF_MAX_AGE}`
  }

  return ''
}

export function getStaffJoiningDateError(ageValue, joiningDateString) {
  if (!joiningDateString) {
    return 'Joining date is required'
  }

  const joined = parseDate(joiningDateString)

  if (!joined) {
    return 'Enter a valid joining date'
  }

  if (isAfterToday(joined)) {
    return 'Joining date cannot be in the future'
  }

  return ''
}

export function getStaffJoiningDateWarning(joiningDateString) {
  const joined = parseDate(joiningDateString)

  if (!joined) {
    return ''
  }

  const sixtyYearsAgo = new Date()
  sixtyYearsAgo.setFullYear(sixtyYearsAgo.getFullYear() - 60)

  if (joined < sixtyYearsAgo) {
    return 'Join date is over 60 years ago - please verify'
  }

  return ''
}

export function getStaffCreatedDateError(joiningDateString, createdAtString) {
  const joined = parseDate(joiningDateString)
  const created = parseDate(createdAtString)

  if (!joined || !created) {
    return ''
  }

  if (joined > created) {
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

const DAY_MS = 1000 * 60 * 60 * 24

export function computeTenure(joiningDateString) {
  const joined = parseDate(joiningDateString)

  if (!joined) {
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

  const seen = new Set()

  return staffArray
    .map((staff) => String(staff.role || '').trim())
    .filter((role) => {
      const key = role.toLowerCase()

      if (!role || seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .map((role) =>
      role
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' '),
    )
    .sort()
}
