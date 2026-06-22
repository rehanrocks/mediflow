/* src/lib/seedData.js - Local demo data for frontend-only testing. */
import {
  canTransitionAppointmentStatus,
  getStatusTransitionMessage,
  normalizeAppointmentStatus,
} from './appointmentStatus'
const DEMO_STORAGE_KEY = 'mediflow_demo_data_v4'

const PATIENTS = [
  {
    id: 101,
    full_name: 'Maria Garcia',
    phone: '+15550142111',
    date_of_birth: '1979-04-18',
    sex: 'Female',
    marital_status: 'Married',
    address: '24 Cedar Lane, Springfield',
    weight_kg: 72,
    height_cm: 165,
    physical_activity_level: 'Lightly Active',
    pre_existing_conditions: ['Post-op hip replacement'],
    known_allergies: ['Penicillin'],
    current_medications: ['Ibuprofen'],
    blood_group: 'O+',
    onboarding_date: '2025-02-12',
  },
  {
    id: 102,
    full_name: 'Robert Johnson',
    phone: '+15550188222',
    date_of_birth: '1967-09-30',
    sex: 'Male',
    marital_status: 'Married',
    address: '88 Pine Street, Springfield',
    weight_kg: 86.4,
    height_cm: 178,
    physical_activity_level: 'Sedentary',
    pre_existing_conditions: ['Diabetes'],
    known_allergies: [],
    current_medications: ['Metformin', 'Atorvastatin'],
    blood_group: 'A+',
    onboarding_date: '2024-11-20',
  },
  {
    id: 103,
    full_name: 'Aisha Khan',
    phone: '+923001234567',
    date_of_birth: '1991-06-03',
    sex: 'Female',
    marital_status: 'Single',
    address: '17 Garden Road, Lahore',
    weight_kg: 64.2,
    height_cm: 164,
    physical_activity_level: 'Moderately Active',
    pre_existing_conditions: ['Hypertension'],
    known_allergies: ['Sulfa drugs'],
    current_medications: ['Amlodipine'],
    blood_group: 'B+',
    onboarding_date: '2025-05-04',
  },
  {
    id: 104,
    full_name: 'Daniel Turner',
    phone: '+15550194444',
    date_of_birth: '1984-01-26',
    sex: 'Male',
    marital_status: 'Divorced',
    address: '341 North Avenue, Springfield',
    weight_kg: 79,
    height_cm: 181,
    physical_activity_level: 'Very Active',
    pre_existing_conditions: [],
    known_allergies: [],
    current_medications: [],
    blood_group: 'AB-',
    onboarding_date: '2025-07-16',
  },
  {
    id: 105,
    full_name: 'Mei Lin',
    phone: '+15550166555',
    date_of_birth: '1996-12-08',
    sex: 'Female',
    marital_status: 'Single',
    address: '9 Lake View, Springfield',
    weight_kg: 58,
    height_cm: 160,
    physical_activity_level: 'Lightly Active',
    pre_existing_conditions: ['Asthma'],
    known_allergies: ['Dust'],
    current_medications: ['Salbutamol inhaler'],
    blood_group: 'O-',
    onboarding_date: '2026-01-08',
  },
  {
    id: 106,
    full_name: 'Omar Hassan',
    phone: '+15550125666',
    date_of_birth: '1962-03-12',
    sex: 'Male',
    marital_status: 'Widowed',
    address: '52 Clinic Road, Springfield',
    weight_kg: 91,
    height_cm: 173,
    physical_activity_level: 'Sedentary',
    pre_existing_conditions: ['Cardiology consult', 'Hypertension'],
    known_allergies: [],
    current_medications: ['Lisinopril'],
    blood_group: 'A-',
    onboarding_date: '2024-08-28',
  },
]

const DOCTORS = [
  {
    id: 201,
    first_name: 'Nora',
    last_name: 'Patel',
    role: 'doctor',
  },
  {
    id: 202,
    first_name: 'Ethan',
    last_name: 'Morris',
    role: 'doctor',
  },
  {
    id: 203,
    first_name: 'Leila',
    last_name: 'Reed',
    role: 'doctor',
  },
]

function addDays(days, hour, minute = 0) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  date.setDate(date.getDate() + days)

  return date.toISOString()
}

function createSeedAppointments() {
  return [
    {
      id: 301,
      patient: 101,
      doctor: 201,
      appointment_dt: addDays(-28, 9, 30),
      reason: 'Surgical recovery review',
      status: 'completed',
      temperature: '37.1',
      blood_pressure: '118/76',
      diagnosis: 'Stable post-operative recovery.',
      treatment_plan: 'Continue mobility exercises and pain management.',
      medications_prescribed: ['Ibuprofen'],
      precautions: ['Avoid stairs without support', 'Report swelling immediately'],
      medical_activity: ['Light walking twice daily'],
      post_scheduling_notes: 'Follow-up scheduled after mobility assessment.',
      additional_notes: 'Patient reports improved sleep.',
      notes: 'Post-op review completed.',
      payment_status: 'paid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-32, 12),
    },
    {
      id: 302,
      patient: 102,
      doctor: 202,
      appointment_dt: addDays(-18, 11),
      reason: 'Glucose control check',
      status: 'completed',
      temperature: '36.8',
      blood_pressure: '132/84',
      diagnosis: 'Diabetes follow-up with mild elevation in fasting readings.',
      treatment_plan: 'Review diet log and continue current medication.',
      medications_prescribed: ['Metformin'],
      precautions: ['Avoid skipped meals'],
      medical_activity: ['20 minute walk after dinner'],
      post_scheduling_notes: '',
      additional_notes: 'Bring glucometer next visit.',
      notes: 'Routine diabetic review.',
      payment_status: 'unpaid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-22, 10),
    },
    {
      id: 303,
      patient: 103,
      doctor: 201,
      appointment_dt: addDays(-7, 14, 15),
      reason: 'Blood pressure follow-up',
      status: 'completed',
      temperature: '',
      blood_pressure: '126/82',
      diagnosis: 'Blood pressure improving.',
      treatment_plan: 'Maintain current medication and monitor twice weekly.',
      medications_prescribed: ['Amlodipine'],
      precautions: ['Limit high sodium foods'],
      medical_activity: ['Light walking'],
      post_scheduling_notes: 'Call if readings exceed 150/95.',
      additional_notes: '',
      notes: 'Follow-up visit.',
      payment_status: 'paid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-9, 9),
    },
    {
      id: 304,
      patient: 104,
      doctor: 203,
      appointment_dt: addDays(1, 10, 30),
      reason: 'Routine physical',
      status: 'scheduled',
      temperature: '',
      blood_pressure: '',
      notes: '',
      payment_status: 'unpaid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-2, 16),
    },
    {
      id: 305,
      patient: 105,
      doctor: 202,
      appointment_dt: addDays(2, 13),
      reason: 'Cough and breathing concerns',
      status: 'scheduled',
      temperature: '37.2',
      blood_pressure: '',
      notes: 'Patient asked for afternoon slot.',
      payment_status: 'unpaid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-1, 11),
    },
    {
      id: 306,
      patient: 106,
      doctor: 203,
      appointment_dt: addDays(3, 15, 45),
      reason: 'Cardiology intake',
      status: 'scheduled',
      temperature: '',
      blood_pressure: '140/90',
      notes: 'Bring previous ECG records.',
      payment_status: 'paid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-3, 15),
    },
    {
      id: 307,
      patient: 101,
      doctor: 201,
      appointment_dt: addDays(8, 9),
      reason: 'Mobility progress check',
      status: 'scheduled',
      temperature: '',
      blood_pressure: '',
      notes: '',
      payment_status: 'unpaid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-1, 8),
    },
  ]
}

function createInitialDemoData() {
  return {
    patients: PATIENTS,
    doctors: DOCTORS,
    appointments: createSeedAppointments(),
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readDemoData() {
  try {
    const storedData = localStorage.getItem(DEMO_STORAGE_KEY)

    if (!storedData) {
      const initialData = createInitialDemoData()
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initialData))
      return initialData
    }

    const parsedData = JSON.parse(storedData)

    if (
      Array.isArray(parsedData?.patients) &&
      Array.isArray(parsedData?.doctors) &&
      Array.isArray(parsedData?.appointments)
    ) {
      return parsedData
    }
  } catch {
    // Reset corrupt demo storage below.
  }

  const initialData = createInitialDemoData()
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initialData))
  return initialData
}

function writeDemoData(data) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data))
  return data
}

function getNextId(records) {
  const maxId = records.reduce((max, record) => {
    const numericId = Number(record.id)
    return Number.isFinite(numericId) && numericId > max ? numericId : max
  }, 0)

  return maxId + 1
}

function createDemoError(message, status = 400) {
  const error = new Error(message)
  error.response = {
    status,
    data: {
      detail: message,
    },
  }
  throw error
}

function getDate(appointment) {
  const date = new Date(appointment.appointment_dt)
  return Number.isNaN(date.getTime()) ? null : date
}

function decoratePatients(data, patients = data.patients) {
  return patients.map((patient) => {
    const patientAppointments = data.appointments.filter(
      (appointment) => String(appointment.patient) === String(patient.id),
    )
    const completed = patientAppointments
      .filter((appointment) => appointment.status === 'completed')
      .sort((first, second) => getDate(second) - getDate(first))
    const scheduled = patientAppointments
      .filter((appointment) => appointment.status === 'scheduled')
      .sort((first, second) => getDate(first) - getDate(second))

    return {
      ...patient,
      last_visit_date: completed[0]?.appointment_dt || '',
      next_appointment_date: scheduled[0]?.appointment_dt || '',
    }
  })
}

function doctorName(doctor) {
  return [doctor?.first_name, doctor?.last_name].filter(Boolean).join(' ')
}

function decorateAppointment(data, appointment) {
  const patient = data.patients.find(
    (candidate) => String(candidate.id) === String(appointment.patient),
  )
  const doctor = data.doctors.find(
    (candidate) => String(candidate.id) === String(appointment.doctor),
  )

  return {
    ...appointment,
    patient_name: patient?.full_name || 'Unknown patient',
    doctor_name: doctorName(doctor) || 'Unknown doctor',
  }
}

function normalizeParams(params = '') {
  if (typeof params === 'string') {
    return params.trim() ? { search: params.trim() } : {}
  }

  return params || {}
}

export function getDemoPatients(params = '') {
  const data = readDemoData()
  const normalizedParams = normalizeParams(params)
  const search = String(normalizedParams.search || '').trim().toLowerCase()
  const phone = String(normalizedParams.phone || '').trim()
  let patients = data.patients

  if (phone) {
    patients = patients.filter((patient) => patient.phone === phone)
  }

  if (search) {
    patients = patients.filter((patient) => {
      const text = [
        patient.full_name,
        patient.phone,
        patient.pre_existing_conditions?.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return text.includes(search)
    })
  }

  return clone(decoratePatients(data, patients))
}

export function getDemoPatient(id) {
  const data = readDemoData()
  const patient = data.patients.find(
    (candidate) => String(candidate.id) === String(id),
  )

  if (!patient) {
    createDemoError('Patient not found', 404)
  }

  return clone(decoratePatients(data, [patient])[0])
}

export function createDemoPatient(patient) {
  const data = readDemoData()

  if (data.patients.some((currentPatient) => currentPatient.phone === patient.phone)) {
    createDemoError('Phone already registered')
  }

  const createdPatient = {
    ...patient,
    id: getNextId(data.patients),
    onboarding_date: new Date().toISOString(),
  }

  data.patients = [createdPatient, ...data.patients]
  writeDemoData(data)

  return clone(decoratePatients(data, [createdPatient])[0])
}

export function updateDemoPatient(id, patient) {
  const data = readDemoData()
  const patientId = String(id)
  const duplicate = data.patients.find(
    (currentPatient) =>
      currentPatient.phone === patient.phone &&
      String(currentPatient.id) !== patientId,
  )

  if (duplicate) {
    createDemoError('Phone already registered')
  }

  let updatedPatient = null

  data.patients = data.patients.map((currentPatient) => {
    if (String(currentPatient.id) !== patientId) {
      return currentPatient
    }

    updatedPatient = {
      ...currentPatient,
      ...patient,
    }

    return updatedPatient
  })

  if (!updatedPatient) {
    createDemoError('Patient not found', 404)
  }

  writeDemoData(data)

  return clone(decoratePatients(data, [updatedPatient])[0])
}

export function deleteDemoPatient(id) {
  const data = readDemoData()
  const patientId = String(id)

  data.patients = data.patients.filter(
    (patient) => String(patient.id) !== patientId,
  )
  data.appointments = data.appointments.filter(
    (appointment) => String(appointment.patient) !== patientId,
  )
  writeDemoData(data)

  return { id }
}

export function getDemoDoctors() {
  return clone(readDemoData().doctors)
}

export function getDemoAppointments(params = {}) {
  const data = readDemoData()
  const normalizedParams = normalizeParams(params)
  let appointments = data.appointments

  if (normalizedParams.patient) {
    appointments = appointments.filter(
      (appointment) => String(appointment.patient) === String(normalizedParams.patient),
    )
  }

  if (normalizedParams.status) {
    appointments = appointments.filter(
      (appointment) =>
        String(appointment.status || '').toLowerCase() ===
        String(normalizedParams.status).toLowerCase(),
    )
  }

  if (normalizedParams.ordering === '-appointment_dt') {
    appointments = [...appointments].sort((first, second) => getDate(second) - getDate(first))
  } else if (normalizedParams.ordering === 'appointment_dt') {
    appointments = [...appointments].sort((first, second) => getDate(first) - getDate(second))
  }

  return clone(appointments.map((appointment) => decorateAppointment(data, appointment)))
}

export function getDemoAppointment(id) {
  const data = readDemoData()
  const appointment = data.appointments.find(
    (candidate) => String(candidate.id) === String(id),
  )

  if (!appointment) {
    createDemoError('Appointment not found', 404)
  }

  return clone(decorateAppointment(data, appointment))
}

export function bookDemoAppointment(appointment) {
  const data = readDemoData()
  const bookedAppointment = {
    id: getNextId(data.appointments),
    patient: Number(appointment.patient),
    doctor: Number(appointment.doctor),
    appointment_dt: appointment.appointment_dt,
    reason: appointment.reason || '',
    temperature: appointment.temperature || '',
    blood_pressure: appointment.blood_pressure || '',
    notes: appointment.notes || '',
    payment_status: appointment.payment_status || 'unpaid',
    status: appointment.status || 'scheduled',
    booked_by_name: 'Dana Teller',
    booked_at: new Date().toISOString(),
  }

  data.appointments = [bookedAppointment, ...data.appointments]
  writeDemoData(data)

  return clone(decorateAppointment(data, bookedAppointment))
}

export function updateDemoAppointment(id, appointment) {
  const data = readDemoData()
  const appointmentId = String(id)
  let updatedAppointment = null

  data.appointments = data.appointments.map((currentAppointment) => {
    if (String(currentAppointment.id) !== appointmentId) {
      return currentAppointment
    }

    if (
      currentAppointment.payment_status === 'paid' &&
      appointment.payment_status === 'unpaid'
    ) {
      createDemoError('Paid appointments cannot be reverted to unpaid')
    }

    if (
      appointment.status &&
      !canTransitionAppointmentStatus(currentAppointment.status, appointment.status)
    ) {
      createDemoError(
        getStatusTransitionMessage(currentAppointment.status, appointment.status),
      )
    }

    updatedAppointment = {
      ...currentAppointment,
      ...appointment,
      status: appointment.status
        ? normalizeAppointmentStatus(appointment.status)
        : currentAppointment.status,
    }

    return updatedAppointment
  })

  if (!updatedAppointment) {
    createDemoError('Appointment not found', 404)
  }

  writeDemoData(data)

  return clone(decorateAppointment(data, updatedAppointment))
}

export function deleteDemoAppointment(id) {
  const data = readDemoData()
  const appointmentId = String(id)

  data.appointments = data.appointments.filter(
    (appointment) => String(appointment.id) !== appointmentId,
  )
  writeDemoData(data)

  return { id }
}

export function updateDemoStatus(id, status) {
  return updateDemoAppointment(id, { status })
}

export function updateDemoPayment(id, paymentStatus) {
  return updateDemoAppointment(id, { payment_status: paymentStatus })
}

export function resetDemoData() {
  const initialData = createInitialDemoData()
  writeDemoData(initialData)
  return clone(initialData)
}
