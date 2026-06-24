/* src/shared/lib/doctorUtils.js - Utility functions for doctors feature. */

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

export function formatShiftTime(time24) {
  const parts = parseTimeParts(time24)

  if (!parts) return ''

  const ampm = parts.hour >= 12 ? 'PM' : 'AM'
  const displayHour = parts.hour % 12 || 12
  return `${displayHour}:${String(parts.minute).padStart(2, '0')} ${ampm}`
}

export function computeAverages(dailyCases = []) {
  if (!Array.isArray(dailyCases) || dailyCases.length === 0) {
    return { avg7: 0, avg30: 0 }
  }

  const last7 = dailyCases.slice(-7)
  const last30 = dailyCases.slice(-30)
  const sum7 = last7.reduce((acc, item) => acc + Number(item.count || 0), 0)
  const sum30 = last30.reduce((acc, item) => acc + Number(item.count || 0), 0)

  return {
    avg7: Number((sum7 / last7.length).toFixed(1)),
    avg30: Number((sum30 / last30.length).toFixed(1)),
  }
}

export function isOnShift(shift_start, shift_end) {
  const start = parseTimeParts(shift_start)
  const end = parseTimeParts(shift_end)

  if (!start || !end) return false

  const now = new Date()
  const startDate = new Date(now)
  startDate.setHours(start.hour, start.minute, 0, 0)

  const endDate = new Date(now)
  endDate.setHours(end.hour, end.minute, 0, 0)

  return now >= startDate && now <= endDate
}
