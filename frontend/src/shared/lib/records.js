import { computeAge } from './age'

export function normalizeList(response) {
  if (Array.isArray(response)) {
    return response
  }

  if (Array.isArray(response?.results)) {
    return response.results
  }

  return []
}

export function getRecordId(record) {
  return record?.id ?? record?.pk ?? record?.uuid
}

export function getPersonName(person, fallback = 'Unknown') {
  if (!person) {
    return fallback
  }

  if (typeof person === 'string' || typeof person === 'number') {
    return String(person)
  }

  return (
    person.full_name ||
    [person.first_name, person.last_name].filter(Boolean).join(' ') ||
    person.name ||
    person.username ||
    person.email ||
    fallback
  )
}

export function getPatientName(patient, fallback = 'Unnamed patient') {
  return getPersonName(patient, fallback)
}

export function getDoctorName(doctor, fallback = 'Doctor') {
  if (!doctor) {
    return fallback
  }

  if (typeof doctor === 'string' || typeof doctor === 'number') {
    return String(doctor)
  }

  return (
    String(doctor.full_name || '').trim() ||
    doctor.username ||
    doctor.email ||
    fallback
  )
}

export function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export function getPatientDob(patient) {
  return patient?.date_of_birth || patient?.dob || patient?.birth_date || ''
}

export function getPatientAge(patient) {
  const age = computeAge(getPatientDob(patient))

  return Number.isFinite(age) ? age : null
}

export function getPatientConditions(patient) {
  const conditions = normalizeStringArray(patient?.pre_existing_conditions)

  if (conditions.length > 0) {
    return conditions
  }

  return normalizeStringArray(patient?.condition)
}

export function getPatientAllergies(patient) {
  return normalizeStringArray(patient?.known_allergies || patient?.allergies)
}

export function getPatientMedications(patient) {
  return normalizeStringArray(patient?.current_medications || patient?.medications)
}

export function formatDate(value, fallback = '-') {
  if (!value) {
    return fallback
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value, fallback = '-') {
  if (!value) {
    return fallback
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatDateParts(value) {
  if (!value) {
    return { date: '-', time: '' }
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return { date: '-', time: '' }
  }

  return {
    date: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  }
}

export function getAppointmentDate(appointment) {
  const value = appointment?.appointment_dt || appointment?.date

  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

export function getAppointmentPatientId(appointment) {
  return getRecordId(appointment?.patient) ?? appointment?.patient
}

export function getAppointmentDoctorId(appointment) {
  return getRecordId(appointment?.doctor) ?? appointment?.doctor
}

export function resolvePatient(appointment, patients = []) {
  if (typeof appointment?.patient === 'object') {
    return appointment.patient
  }

  const patientId = getAppointmentPatientId(appointment)

  return patients.find(
    (patient) => String(getRecordId(patient)) === String(patientId),
  )
}

export function resolveDoctor(appointment, doctors = []) {
  if (typeof appointment?.doctor === 'object') {
    return appointment.doctor
  }

  const doctorId = getAppointmentDoctorId(appointment)

  return doctors.find(
    (doctor) => String(getRecordId(doctor)) === String(doctorId),
  )
}

export function getAppointmentPatientName(appointment, patients = []) {
  return (
    appointment?.patient_name ||
    getPatientName(resolvePatient(appointment, patients), 'Unknown patient')
  )
}

export function getAppointmentDoctorName(appointment, doctors = []) {
  return (
    appointment?.doctor_name ||
    getDoctorName(resolveDoctor(appointment, doctors), 'Doctor')
  )
}

export function getVitalsText(appointment) {
  const values = [
    appointment?.temperature ? `${appointment.temperature}°C` : '',
    appointment?.blood_pressure || '',
  ].filter(Boolean)

  return values.length > 0 ? values.join(' · ') : ''
}

export function getPaymentStatus(value) {
  return String(value || 'unpaid').toLowerCase() === 'paid' ? 'paid' : 'unpaid'
}

export function getBackendError(error, fallback) {
  const data = error?.response?.data

  if (typeof error?.detail === 'string') {
    return error.detail
  }

  if (typeof data?.detail === 'string') {
    return data.detail
  }

  if (typeof data === 'string') {
    return data
  }

  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([field, messages]) => {
        const message = Array.isArray(messages) ? messages.join(' ') : messages
        return `${field}: ${message}`
      })
      .join(' ')
  }

  return fallback
}
