function parseTimeParts(time24) {
  if (!time24 || typeof time24 !== 'string') return null

  const [hours, minutes = '0'] = time24.split(':')
  const hour = Number(hours)
  const minute = Number(minutes)

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null
  }

  return { hour, minute }
}

export function formatShiftTime(time24, fallback = '-') {
  const parts = parseTimeParts(time24)

  if (!parts) return fallback

  const ampm = parts.hour >= 12 ? 'PM' : 'AM'
  const displayHour = parts.hour % 12 || 12
  return `${displayHour}:${String(parts.minute).padStart(2, '0')} ${ampm}`
}

export function formatShiftRange(shiftStart, shiftEnd, fallback = '-') {
  if (!shiftStart || !shiftEnd) {
    return fallback
  }

  return `${formatShiftTime(shiftStart)} - ${formatShiftTime(shiftEnd)}`
}

export function isEndAfterStart(start, end) {
  if (!start || !end) {
    return false
  }

  return end > start
}
