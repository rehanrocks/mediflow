export const APPOINTMENT_STATUS_OPTIONS = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]

const STATUS_TRANSITIONS = {
  scheduled: ['scheduled', 'in_progress', 'cancelled'],
  in_progress: ['in_progress', 'completed', 'cancelled'],
  completed: ['completed'],
  cancelled: ['cancelled'],
}

export function normalizeAppointmentStatus(status) {
  const normalizedStatus = String(status || 'scheduled').toLowerCase()

  return APPOINTMENT_STATUS_OPTIONS.includes(normalizedStatus)
    ? normalizedStatus
    : 'scheduled'
}

export function getAllowedAppointmentStatuses(status) {
  return STATUS_TRANSITIONS[normalizeAppointmentStatus(status)]
}

export function canTransitionAppointmentStatus(currentStatus, nextStatus) {
  return getAllowedAppointmentStatuses(currentStatus).includes(
    normalizeAppointmentStatus(nextStatus),
  )
}

export function getStatusTransitionMessage(currentStatus, nextStatus) {
  const current = normalizeAppointmentStatus(currentStatus)
  const next = normalizeAppointmentStatus(nextStatus)

  if (current === next) {
    return ''
  }

  if (current === 'cancelled') {
    return 'Cancelled appointments cannot be reopened or completed.'
  }

  if (current === 'completed') {
    return 'Completed appointments are final and cannot be changed.'
  }

  if (current === 'in_progress' && next === 'scheduled') {
    return 'In-progress appointments cannot move back to scheduled.'
  }

  if (current === 'scheduled' && next === 'completed') {
    return 'Start the appointment before marking it completed.'
  }

  return 'This status change is not allowed.'
}

export function isTerminalAppointmentStatus(status) {
  return ['completed', 'cancelled'].includes(normalizeAppointmentStatus(status))
}
