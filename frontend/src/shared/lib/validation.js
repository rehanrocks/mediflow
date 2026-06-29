import { computeAge } from './age'

export const E164_REGEX = /^\+[1-9]\d{7,14}$/
export const BLOOD_PRESSURE_REGEX = /^\d{1,3}\/\d{1,3}$/
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validatePhone(value) {
  if (!E164_REGEX.test(String(value || '').trim())) {
    return 'Phone must be in E.164 format - e.g. +923001234567'
  }

  return null
}

export function validateEmail(value) {
  if (!EMAIL_REGEX.test(String(value || '').trim())) {
    return 'Please enter a valid email address'
  }

  return null
}

export function validateRequired(value, label) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return `${label} is required.`
  }

  return null
}

export function validatePositiveNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  const numberValue = Number(value)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 'Must be greater than 0'
  }

  return null
}

export function validateDateOfBirth(value) {
  const requiredError = validateRequired(value, 'Date of birth')

  if (requiredError) {
    return requiredError
  }

  const date = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (Number.isNaN(date.getTime())) {
    return 'Enter a valid date of birth.'
  }

  if (date >= today) {
    return 'Date of birth cannot be in the future'
  }

  const age = computeAge(value)

  if (age > 130) {
    return 'Age cannot be greater than 130 years.'
  }

  return null
}

export function validateFutureDateTime(value) {
  const requiredError = validateRequired(value, 'Date and time')

  if (requiredError) {
    return requiredError
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Enter a valid date and time.'
  }

  if (date <= new Date()) {
    return 'Appointment date and time must be in the future.'
  }

  return null
}

export function validateBloodPressure(value) {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return null
  }

  if (!BLOOD_PRESSURE_REGEX.test(normalizedValue)) {
    return 'Use format: systolic/diastolic - e.g. 120/80'
  }

  const [systolic, diastolic] = normalizedValue
    .split('/')
    .map((part) => Number(part))

  if (systolic <= 0 || diastolic <= 0) {
    return 'Must be greater than 0'
  }

  if (systolic < 50 || systolic > 250 || diastolic < 30 || diastolic > 150) {
    return 'Blood pressure must be in range: systolic 50-250, diastolic 30-150'
  }

  return null
}

export function getTemperatureWarning(value) {
  if (!String(value || '').trim()) {
    return null
  }

  const temperature = Number(value)

  if (!Number.isFinite(temperature) || temperature < 30 || temperature > 45) {
    return 'Unlikely temperature - please verify'
  }

  return null
}
