/* src/shared/lib/seedData.js - Local demo data for frontend-only testing. */
import {
  canTransitionAppointmentStatus,
  getStatusTransitionMessage,
  normalizeAppointmentStatus,
} from './appointmentStatus'
import { ensureDemoRoleName } from './accessControlData'
import { computeAge } from './age'
import { getStaffDataIssues } from './staffUtils'
import {
  getPublicTestingSession,
  getPublicTestingUser,
  PUBLIC_ROUTES_FOR_TESTING,
} from './testingAccess'

const DEMO_STORAGE_KEY = 'mediflow_demo_data_v7'

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
    full_name: 'Nora Patel',
    email: 'nora.patel@clinic.com',
    phone: '+1555010101',
    role: 'doctor',
    status: 'active',
    qualification: 'MD - Orthopedic Surgery',
    experience_years: 8,
    specializations: [
      'Orthopedics',
      'Sports Medicine',
      'General Physician',
      'Dermatology',
      'ENT',
    ],
    join_date: '2018-03-15',
    created_at: '2024-01-08T09:00:00.000Z',
    shift_start: '09:00',
    shift_end: '17:00',
    today_checkin: addDays(0, 8, 42),
    cases_today: 4,
    cases_this_week: 18,
    cases_this_month: 64,
    total_cases: 1340,
    avg_cases_per_day: 5.6,
    avatar_url: null,
  },
  {
    id: 202,
    first_name: 'Ethan',
    last_name: 'Morris',
    full_name: 'Ethan Morris',
    email: 'ethan.morris@clinic.com',
    phone: '+1555010102',
    role: 'doctor',
    status: 'active',
    qualification: 'MD - Cardiology',
    experience_years: 12,
    specializations: [
      'Cardiology',
      'Internal Medicine',
      'Neurology',
      'Oncology',
      'Psychiatry',
    ],
    join_date: '2014-07-20',
    created_at: '2024-01-12T09:00:00.000Z',
    shift_start: '08:00',
    shift_end: '16:00',
    today_checkin: addDays(0, 7, 55),
    cases_today: 6,
    cases_this_week: 22,
    cases_this_month: 81,
    total_cases: 2104,
    avg_cases_per_day: 7.2,
    avatar_url: null,
  },
  {
    id: 203,
    first_name: 'Leila',
    last_name: 'Reed',
    full_name: 'Leila Reed',
    email: 'leila.reed@clinic.com',
    phone: '+1555010103',
    role: 'doctor',
    status: 'active',
    qualification: 'MD - Pediatrics',
    experience_years: 6,
    specializations: [
      'Pediatrics',
      'Neonatology',
      'Gynecology',
      'Dentistry',
      'Ophthalmology',
    ],
    join_date: '2020-01-10',
    created_at: '2024-02-05T09:00:00.000Z',
    shift_start: '10:00',
    shift_end: '18:00',
    today_checkin: null,
    cases_today: 0,
    cases_this_week: 7,
    cases_this_month: 39,
    total_cases: 916,
    avg_cases_per_day: 4.1,
    avatar_url: null,
  },
]

const QUALIFICATIONS = [
  { id: 1, name: 'MD - Orthopedic Surgery' },
  { id: 2, name: 'MD - Cardiology' },
  { id: 3, name: 'MD - Pediatrics' },
  { id: 4, name: 'MBBS' },
  { id: 5, name: 'FCPS' },
]

const STAFF = [
  {
    id: 401,
    full_name: 'Dana Teller',
    age: 34,
    phone: '+1555020101',
    address: '12 Elm Street, Springfield',
    role: 'Reception Desk',
    status: 'active',
    joining_date: '2021-05-17',
    shift_start: '09:00',
    shift_end: '17:00',
    created_at: '2024-01-10T09:15:00.000Z',
    notes: 'Handles front desk intake and appointment coordination.',
  },
  {
    id: 402,
    full_name: 'Imran Malik',
    age: 41,
    phone: '+923001112222',
    address: '45 Clinic Road, Lahore',
    role: 'Ward Boy',
    status: 'active',
    joining_date: '2020-11-02',
    shift_start: '08:00',
    shift_end: '16:00',
    created_at: '2024-01-12T10:30:00.000Z',
    notes: 'Assigned to patient movement and ward support.',
  },
  {
    id: 403,
    full_name: 'Grace Wilson',
    age: 29,
    phone: '+1555020103',
    address: '88 Pine Street, Springfield',
    role: 'Nurse',
    status: 'active',
    joining_date: '2023-08-21',
    shift_start: '10:00',
    shift_end: '18:00',
    created_at: '2024-02-03T11:45:00.000Z',
    notes: 'Supports vitals collection before consultations.',
  },
  {
    id: 404,
    full_name: 'Farah Ahmed',
    age: 38,
    phone: '+923001113333',
    address: null,
    role: 'Cleaner',
    status: 'inactive',
    joining_date: '2022-02-14',
    shift_start: '07:00',
    shift_end: '15:00',
    created_at: '2024-03-08T08:05:00.000Z',
    notes: null,
  },
]

function addDays(days, hour, minute = 0) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  date.setDate(date.getDate() + days)

  return date.toISOString()
}

function withPatientDefaults(patient) {
  return {
    ...patient,
    created_at: patient.created_at || patient.onboarding_date || new Date().toISOString(),
  }
}

function splitQualificationNames(value) {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' ? item.name : item))
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeQualificationRecords(records = [], doctors = []) {
  const seen = new Set()
  const qualifications = []

  ;[...QUALIFICATIONS, ...records].forEach((qualification) => {
    const name = String(qualification?.name || qualification || '').trim()
    const key = name.toLowerCase()

    if (!name || seen.has(key)) {
      return
    }

    seen.add(key)
    qualifications.push({
      id: Number(qualification?.id) || qualifications.length + 1,
      name,
    })
  })

  doctors.forEach((doctor) => {
    splitQualificationNames(doctor.qualifications?.length ? doctor.qualifications : doctor.qualification)
      .forEach((name) => {
        const key = name.toLowerCase()

        if (!seen.has(key)) {
          seen.add(key)
          qualifications.push({
            id: qualifications.length + 1,
            name,
          })
        }
      })
  })

  return qualifications.map((qualification, index) => ({
    ...qualification,
    id: Number(qualification.id) || index + 1,
  }))
}

function getQualificationObjects(qualifications, value, legacyValue = '') {
  const ids = Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'object' ? item.id : item))
        .filter((item) => item !== undefined && item !== null)
    : []
  const names = Array.isArray(value)
    ? value
        .filter((item) => typeof item === 'object' && item.name)
        .map((item) => item.name)
    : splitQualificationNames(legacyValue)
  const selected = []

  ids.forEach((id) => {
    const match = qualifications.find(
      (qualification) => String(qualification.id) === String(id),
    )

    if (match && !selected.some((item) => item.id === match.id)) {
      selected.push(match)
    }
  })

  names.forEach((name) => {
    const match = qualifications.find(
      (qualification) =>
        qualification.name.toLowerCase() === String(name).trim().toLowerCase(),
    )

    if (match && !selected.some((item) => item.id === match.id)) {
      selected.push(match)
    }
  })

  return selected
}

function withDoctorDefaults(doctor, qualifications = []) {
  const firstName = String(doctor.first_name || '').trim()
  const lastName = String(doctor.last_name || '').trim()
  const fullName =
    String(doctor.full_name || '').trim() ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    doctor.username ||
    'Doctor'
  const selectedQualifications = getQualificationObjects(
    qualifications,
    doctor.qualification_ids || doctor.qualifications,
    doctor.qualification,
  )

  return {
    ...doctor,
    created_at: doctor.created_at || doctor.join_date || new Date().toISOString(),
    first_name: firstName || fullName.split(' ')[0] || '',
    last_name: lastName || fullName.split(' ').slice(1).join(' ') || '',
    full_name: fullName,
    qualification: selectedQualifications.map((item) => item.name).join(', ') || doctor.qualification || '',
    qualifications: selectedQualifications,
    today_checkin:
      doctor.today_checkin === undefined ? null : doctor.today_checkin,
  }
}

function normalizeDemoData(data) {
  const qualifications = normalizeQualificationRecords(
    data.qualifications,
    data.doctors || DOCTORS,
  )

  return {
    patients: (data.patients || []).map(withPatientDefaults),
    doctors: (data.doctors || []).map((doctor) =>
      withDoctorDefaults(doctor, qualifications),
    ),
    qualifications,
    staff: (Array.isArray(data.staff) ? data.staff : STAFF).map((staffMember) => ({
      ...staffMember,
      shift_start: staffMember.shift_start ?? null,
      shift_end: staffMember.shift_end ?? null,
    })),
    appointments: Array.isArray(data.appointments) ? data.appointments : [],
  }
}

function createExtraCompletedAppointments() {
  const patientIds = [104, 105, 106, 101, 102, 103, 104, 105]

  return patientIds.map((patientId, index) => ({
    id: 308 + index,
    patient: patientId,
    doctor: 201,
    appointment_dt: addDays(-6 - index, 8 + (index % 4), index % 2 === 0 ? 15 : 45),
    reason: `Follow-up review ${index + 1}`,
    status: 'completed',
    temperature: index % 2 === 0 ? '36.9' : '',
    blood_pressure: index % 3 === 0 ? '122/80' : '',
    diagnosis: 'Stable progress noted during follow-up.',
    treatment_plan: 'Continue current plan and return if symptoms change.',
    medications_prescribed: [],
    precautions: ['Hydrate well', 'Continue home care'],
    medical_activity: ['Daily walking'],
    post_scheduling_notes: '',
    additional_notes: '',
    notes: 'Routine follow-up visit.',
    payment_status: index % 3 === 0 ? 'unpaid' : 'paid',
    booked_by_name: 'Dana Teller',
    booked_at: addDays(-10 - index, 9),
  }))
}

function createTodayAppointments() {
  return [
    {
      id: 316,
      patient: 104,
      doctor: 201,
      appointment_dt: addDays(0, 9, 0),
      reason: 'Cast removal check',
      status: 'completed',
      temperature: '36.8',
      blood_pressure: '120/78',
      diagnosis: 'Healing well with no swelling.',
      treatment_plan: 'Begin light stretching exercises.',
      notes: 'Completed morning review.',
      payment_status: 'paid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-1, 13),
    },
    {
      id: 317,
      patient: 105,
      doctor: 201,
      appointment_dt: addDays(0, 10, 30),
      reason: 'Asthma control review',
      status: 'scheduled',
      temperature: '',
      blood_pressure: '',
      notes: 'Bring inhaler usage log.',
      payment_status: 'unpaid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-1, 14),
    },
    {
      id: 318,
      patient: 106,
      doctor: 201,
      appointment_dt: addDays(0, 13, 15),
      reason: 'Cardiac medication follow-up',
      status: 'in_progress',
      temperature: '',
      blood_pressure: '138/86',
      notes: 'Patient arrived early.',
      payment_status: 'paid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-1, 15),
    },
    {
      id: 319,
      patient: 101,
      doctor: 201,
      appointment_dt: addDays(0, 15, 45),
      reason: 'Mobility range review',
      status: 'scheduled',
      temperature: '',
      blood_pressure: '',
      notes: '',
      payment_status: 'unpaid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-1, 16),
    },
    {
      id: 320,
      patient: 102,
      doctor: 202,
      appointment_dt: addDays(0, 9, 50),
      reason: 'Blood sugar monitoring review',
      status: 'scheduled',
      temperature: '36.7',
      blood_pressure: '130/82',
      notes: 'Patient requested quick review before work.',
      payment_status: 'paid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-2, 11),
    },
    {
      id: 321,
      patient: 103,
      doctor: 202,
      appointment_dt: addDays(0, 14, 10),
      reason: 'Hypertension medication check',
      status: 'scheduled',
      temperature: '',
      blood_pressure: '128/80',
      notes: '',
      payment_status: 'unpaid',
      booked_by_name: 'Dana Teller',
      booked_at: addDays(-2, 12),
    },
  ]
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
    ...createExtraCompletedAppointments(),
    ...createTodayAppointments(),
  ]
}

function createInitialDemoData() {
  return normalizeDemoData({
    patients: PATIENTS,
    doctors: DOCTORS,
    qualifications: QUALIFICATIONS,
    staff: STAFF,
    appointments: createSeedAppointments(),
  })
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
      const normalizedData = normalizeDemoData(parsedData)
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(normalizedData))
      return normalizedData
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

function validateDemoStaff(staffMember) {
  const issue = getStaffDataIssues(staffMember)[0]

  if (issue) {
    createDemoError(issue)
  }
}

function getDate(appointment) {
  const date = new Date(appointment.appointment_dt)
  return Number.isNaN(date.getTime()) ? null : date
}

function sortAppointmentsByOrdering(appointments, ordering) {
  if (ordering === '-appointment_dt') {
    return [...appointments].sort((first, second) => getDate(second) - getDate(first))
  }

  if (ordering !== 'appointment_dt') {
    return appointments
  }

  const now = new Date()

  return [...appointments].sort((first, second) => {
    const firstDate = getDate(first)
    const secondDate = getDate(second)
    const firstUpcoming = firstDate && firstDate >= now
    const secondUpcoming = secondDate && secondDate >= now

    if (firstUpcoming !== secondUpcoming) {
      return firstUpcoming ? -1 : 1
    }

    return firstUpcoming ? firstDate - secondDate : secondDate - firstDate
  })
}

function getDateKey(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().split('T')[0]
}

function isSameDay(value, reference = new Date()) {
  return Boolean(value) && getDateKey(value) === getDateKey(reference)
}

function getStoredDemoUser() {
  if (PUBLIC_ROUTES_FOR_TESTING) {
    const session = getPublicTestingSession()

    return session?.user
      ? {
          ...session.user,
          role: session.role?.slug,
        }
      : getPublicTestingUser()
  }

  try {
    const storedUser = localStorage.getItem('user')
    const storedRole = localStorage.getItem('role')
    const parsedUser = storedUser ? JSON.parse(storedUser) : getPublicTestingUser()
    const parsedRole = storedRole ? JSON.parse(storedRole) : null

    return parsedUser
      ? {
          ...parsedUser,
          role: parsedRole?.slug ?? parsedUser.role,
        }
      : getPublicTestingUser()
  } catch {
    return getPublicTestingUser()
  }
}

function getCurrentDemoDoctorId() {
  const user = getStoredDemoUser()

  if (user?.role !== 'doctor') {
    return null
  }

  return user.user_id ?? user.doctor_id ?? user.id ?? null
}

function scopeAppointmentsForCurrentDoctor(appointments) {
  const doctorId = getCurrentDemoDoctorId()

  if (!doctorId) {
    return appointments
  }

  return appointments.filter(
    (appointment) => String(appointment.doctor) === String(doctorId),
  )
}

function canCurrentDoctorAccessDoctorRecord(doctorId) {
  const currentDoctorId = getCurrentDemoDoctorId()
  return !currentDoctorId || String(currentDoctorId) === String(doctorId)
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
    patient_age: patient ? computeAge(patient.date_of_birth) : null,
    patient_name: patient?.full_name || 'Unknown patient',
    doctor_name: doctorName(doctor) || 'Unknown doctor',
  }
}

function getRecentDateKeys(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (days - index - 1))
    return date.toISOString().split('T')[0]
  })
}

function countCasesForDate(appointments, dateKey) {
  return appointments.filter(
    (appointment) =>
      appointment.status !== 'cancelled' &&
      getDateKey(appointment.appointment_dt) === dateKey,
  ).length
}

function decorateDoctor(data, doctor) {
  const doctorAppointments = data.appointments.filter(
    (appointment) => String(appointment.doctor) === String(doctor.id),
  )
  const caseAppointments = doctorAppointments.filter(
    (appointment) => appointment.status !== 'cancelled',
  )
  const last30 = getRecentDateKeys(30)
  const dailyCases = last30.map((date, index) => ({
    date,
    count:
      countCasesForDate(caseAppointments, date) ||
      ((Number(doctor.id) + index) % 5 === 0 ? 2 : (Number(doctor.id) + index) % 3),
  }))
  const todayKey = new Date().toISOString().split('T')[0]
  const currentMonth = todayKey.slice(0, 7)
  const casesThisMonth = caseAppointments.filter(
    (appointment) => getDateKey(appointment.appointment_dt).slice(0, 7) === currentMonth,
  ).length
  const casesThisWeek = dailyCases
    .slice(-7)
    .reduce((sum, item) => sum + Number(item.count || 0), 0)

  return {
    ...doctor,
    daily_cases: dailyCases.slice(-7),
    cases_today:
      doctor.cases_today ?? countCasesForDate(caseAppointments, todayKey),
    cases_this_week: doctor.cases_this_week ?? casesThisWeek,
    cases_this_month: doctor.cases_this_month ?? casesThisMonth,
    total_cases: doctor.total_cases ?? caseAppointments.length,
    avg_cases_per_day:
      doctor.avg_cases_per_day ??
      Number(
        (
          dailyCases.reduce((sum, item) => sum + Number(item.count || 0), 0) /
          dailyCases.length
        ).toFixed(1),
      ),
  }
}

function normalizeParams(params = '') {
  if (typeof params === 'string') {
    return params.trim() ? { search: params.trim() } : {}
  }

  return params || {}
}

function buildPagedResponse(items, normalizedParams, basePath) {
  const hasPageParams =
    normalizedParams.page !== undefined ||
    normalizedParams.page_size !== undefined ||
    normalizedParams.limit !== undefined ||
    normalizedParams.offset !== undefined

  if (!hasPageParams) {
    return clone(items)
  }

  const pageSize = Number(normalizedParams.page_size || normalizedParams.limit || 10)
  const currentPage = Math.max(Number(normalizedParams.page || 1), 1)
  const offset =
    normalizedParams.offset !== undefined
      ? Number(normalizedParams.offset || 0)
      : (currentPage - 1) * pageSize
  const results = items.slice(offset, offset + pageSize)
  const nextPage = offset + pageSize < items.length ? currentPage + 1 : null
  const previousPage = offset > 0 ? Math.max(currentPage - 1, 1) : null

  return clone({
    count: items.length,
    next: nextPage ? `${basePath}?page=${nextPage}&page_size=${pageSize}` : null,
    previous: previousPage
      ? `${basePath}?page=${previousPage}&page_size=${pageSize}`
      : null,
    results,
  })
}

function compareDateValues(first, second) {
  const firstDate = new Date(first || '')
  const secondDate = new Date(second || '')

  return (
    (Number.isNaN(firstDate.getTime()) ? 0 : firstDate.getTime()) -
    (Number.isNaN(secondDate.getTime()) ? 0 : secondDate.getTime())
  )
}

export function getDemoPatients(params = '') {
  const data = readDemoData()
  const normalizedParams = normalizeParams(params)
  const search = String(normalizedParams.search || '').trim().toLowerCase()
  const phone = String(normalizedParams.phone || '').trim()
  const scopedAppointments = scopeAppointmentsForCurrentDoctor(data.appointments)
  const visiblePatientIds = new Set(
    scopedAppointments.map((appointment) => String(appointment.patient)),
  )
  let patients = getCurrentDemoDoctorId()
    ? data.patients.filter((patient) => visiblePatientIds.has(String(patient.id)))
    : data.patients

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

  if (normalizedParams.ordering === '-created_at') {
    patients = [...patients].sort(
      (first, second) =>
        compareDateValues(second.created_at || second.onboarding_date, first.created_at || first.onboarding_date),
    )
  }

  return buildPagedResponse(
    decoratePatients(data, patients),
    normalizedParams,
    '/patients/',
  )
}

export function getDemoPatient(id) {
  const data = readDemoData()
  const visiblePatientIds = new Set(
    scopeAppointmentsForCurrentDoctor(data.appointments).map((appointment) =>
      String(appointment.patient),
    ),
  )
  const patient = data.patients.find(
    (candidate) => String(candidate.id) === String(id),
  )

  if (!patient || (getCurrentDemoDoctorId() && !visiblePatientIds.has(String(id)))) {
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
    created_at: new Date().toISOString(),
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

export function getDemoDoctors(params = {}) {
  const data = readDemoData()
  const normalizedParams = normalizeParams(params)
  const search = String(normalizedParams.search || '').trim().toLowerCase()
  const status = String(normalizedParams.status || '').trim().toLowerCase()
  const specialization = String(normalizedParams.specialization || '').trim()
  let doctors = data.doctors
    .filter((doctor) => doctor.is_active !== false)
    .map((doctor) => decorateDoctor(data, doctor))

  if (search) {
    doctors = doctors.filter((doctor) => {
      const searchableText = [
        doctor.full_name,
        doctor.username,
        doctor.email,
        doctor.qualification,
        doctor.qualifications?.map((qualification) => qualification.name).join(' '),
        doctor.specializations?.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(search)
    })
  }

  if (status) {
    doctors = doctors.filter(
      (doctor) => String(doctor.status || '').toLowerCase() === status,
    )
  }

  if (specialization) {
    doctors = doctors.filter((doctor) =>
      doctor.specializations?.includes(specialization),
    )
  }

  if (normalizedParams.ordering === '-created_at') {
    doctors = [...doctors].sort((first, second) =>
      compareDateValues(
        second.created_at || second.join_date,
        first.created_at || first.join_date,
      ),
    )
  } else if (normalizedParams.ordering === 'full_name') {
    doctors = [...doctors].sort((first, second) =>
      String(first.full_name || first.username || '').localeCompare(
        String(second.full_name || second.username || ''),
      ),
    )
  }

  return buildPagedResponse(doctors, normalizedParams, '/doctors/')
}

export function getDemoDoctorById(id) {
  const data = readDemoData()
  const doctor = data.doctors.find(
    (candidate) =>
      String(candidate.id) === String(id) && candidate.is_active !== false,
  )

  if (!doctor) {
    createDemoError('Doctor not found', 404)
  }

  return clone(decorateDoctor(data, doctor))
}

export function createDemoDoctor(doctor) {
  const data = readDemoData()
  const normalizedEmail = String(doctor.email || '').trim().toLowerCase()
  const normalizedPhone = String(doctor.phone || '').trim()
  const qualifications = getQualificationObjects(
    data.qualifications,
    doctor.qualification_ids || doctor.qualifications,
    doctor.qualification,
  )
  const firstName = String(doctor.first_name || '').trim()
  const lastName = String(doctor.last_name || '').trim()

  if (
    data.doctors.some(
      (currentDoctor) =>
        currentDoctor.is_active !== false &&
        String(currentDoctor.email || '').trim().toLowerCase() === normalizedEmail,
    )
  ) {
    createDemoError('Email already registered')
  }

  if (
    data.doctors.some(
      (currentDoctor) =>
        currentDoctor.is_active !== false &&
        String(currentDoctor.phone || '').trim() === normalizedPhone,
    )
  ) {
    createDemoError('Phone already registered')
  }

  const createdAt = new Date().toISOString()
  const createdDoctor = {
    ...doctor,
    id: getNextId(data.doctors),
    created_at: createdAt,
    first_name: firstName,
    last_name: lastName,
    full_name:
      [firstName, lastName].filter(Boolean).join(' ') ||
      String(doctor.full_name || '').trim() ||
      doctor.username ||
      'Doctor',
    qualification: qualifications.map((qualification) => qualification.name).join(', '),
    qualifications,
    today_checkin: null,
    cases_today: 0,
    cases_this_week: 0,
    cases_this_month: 0,
    total_cases: 0,
    avg_cases_per_day: 0,
    is_active: true,
  }

  data.doctors = [createdDoctor, ...data.doctors]
  writeDemoData(data)

  return clone(decorateDoctor(data, createdDoctor))
}

export function updateDemoDoctor(id, doctor) {
  const data = readDemoData()
  const doctorId = String(id)
  const normalizedEmail = String(doctor.email || '').trim().toLowerCase()
  const normalizedPhone = String(doctor.phone || '').trim()
  const qualifications = getQualificationObjects(
    data.qualifications,
    doctor.qualification_ids || doctor.qualifications,
    doctor.qualification,
  )
  const firstName = String(doctor.first_name || '').trim()
  const lastName = String(doctor.last_name || '').trim()

  if (
    data.doctors.some(
      (currentDoctor) =>
        currentDoctor.is_active !== false &&
        String(currentDoctor.id) !== doctorId &&
        String(currentDoctor.email || '').trim().toLowerCase() === normalizedEmail,
    )
  ) {
    createDemoError('Email already registered')
  }

  if (
    data.doctors.some(
      (currentDoctor) =>
        currentDoctor.is_active !== false &&
        String(currentDoctor.id) !== doctorId &&
        String(currentDoctor.phone || '').trim() === normalizedPhone,
    )
  ) {
    createDemoError('Phone already registered')
  }

  let updatedDoctor = null

  data.doctors = data.doctors.map((currentDoctor) => {
    if (String(currentDoctor.id) !== doctorId || currentDoctor.is_active === false) {
      return currentDoctor
    }

    updatedDoctor = {
      ...currentDoctor,
      ...doctor,
      first_name: firstName,
      last_name: lastName,
      full_name:
        [firstName, lastName].filter(Boolean).join(' ') ||
        String(doctor.full_name || currentDoctor.full_name || '').trim() ||
        currentDoctor.username ||
        'Doctor',
      qualification: qualifications.map((qualification) => qualification.name).join(', '),
      qualifications,
    }

    return updatedDoctor
  })

  if (!updatedDoctor) {
    createDemoError('Doctor not found', 404)
  }

  writeDemoData(data)

  return clone(decorateDoctor(data, updatedDoctor))
}

export function deleteDemoDoctor(id) {
  const data = readDemoData()
  const doctorId = String(id)
  let deletedDoctor = null

  data.doctors = data.doctors.map((currentDoctor) => {
    if (String(currentDoctor.id) !== doctorId || currentDoctor.is_active === false) {
      return currentDoctor
    }

    deletedDoctor = {
      ...currentDoctor,
      is_active: false,
      deleted_at: new Date().toISOString(),
    }

    return deletedDoctor
  })

  if (!deletedDoctor) {
    createDemoError('Doctor not found', 404)
  }

  writeDemoData(data)

  return { id }
}

export function getDemoQualifications() {
  const data = readDemoData()

  return clone(
    [...data.qualifications].sort((first, second) =>
      first.name.localeCompare(second.name),
    ),
  )
}

export function createDemoQualification(name) {
  const data = readDemoData()
  const trimmedName = String(name || '').trim()

  if (!trimmedName) {
    createDemoError('Qualification name is required')
  }

  const existing = data.qualifications.find(
    (qualification) =>
      qualification.name.toLowerCase() === trimmedName.toLowerCase(),
  )

  if (existing) {
    return clone(existing)
  }

  const qualification = {
    id: getNextId(data.qualifications),
    name: trimmedName,
  }

  data.qualifications = [...data.qualifications, qualification]
  writeDemoData(data)

  return clone(qualification)
}

export function getDemoStaff(params = {}) {
  const data = readDemoData()
  const normalizedParams = normalizeParams(params)
  const search = String(normalizedParams.search || '').trim().toLowerCase()
  const phone = String(normalizedParams.phone || '').trim()
  const status = String(normalizedParams.status || '').trim().toLowerCase()
  const role = String(normalizedParams.role || '').trim().toLowerCase()
  let staff = data.staff.filter((staffMember) => staffMember.is_deleted !== true)

  if (search) {
    staff = staff.filter((staffMember) => {
      const searchableText = [
        staffMember.full_name,
        staffMember.phone,
        staffMember.address,
        staffMember.role,
        staffMember.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(search)
    })
  }

  if (phone) {
    staff = staff.filter(
      (staffMember) => String(staffMember.phone || '').trim() === phone,
    )
  }

  if (status) {
    staff = staff.filter(
      (staffMember) =>
        String(staffMember.status || '').toLowerCase() === status,
    )
  }

  if (role) {
    staff = staff.filter(
      (staffMember) => String(staffMember.role || '').toLowerCase() === role,
    )
  }

  if (normalizedParams.ordering === '-joining_date') {
    staff = [...staff].sort((first, second) =>
      compareDateValues(second.joining_date, first.joining_date),
    )
  }

  return buildPagedResponse(staff, normalizedParams, '/staff/')
}

export function getDemoStaffById(id) {
  const data = readDemoData()
  const staffMember = data.staff.find(
    (candidate) =>
      String(candidate.id) === String(id) && candidate.is_deleted !== true,
  )

  if (!staffMember) {
    createDemoError('Staff member not found', 404)
  }

  return clone(staffMember)
}

export function createDemoStaff(staffMember) {
  const data = readDemoData()
  const normalizedPhone = String(staffMember.phone || '').trim()
  const roleResult = ensureDemoRoleName(staffMember.role)
  const createdAt = new Date().toISOString()
  const nextStaffMember = {
    ...staffMember,
    created_at: createdAt,
  }

  validateDemoStaff(nextStaffMember)

  if (
    data.staff.some(
      (currentStaff) =>
        currentStaff.is_deleted !== true &&
        String(currentStaff.phone || '').trim() === normalizedPhone,
    )
  ) {
    createDemoError('Phone already registered')
  }

  const createdStaff = {
    ...staffMember,
    id: getNextId(data.staff),
    age: Number(staffMember.age),
    address: staffMember.address || null,
    notes: staffMember.notes || null,
    shift_start: staffMember.shift_start || null,
    shift_end: staffMember.shift_end || null,
    created_at: createdAt,
  }

  data.staff = [createdStaff, ...data.staff]
  writeDemoData(data)

  return clone({
    ...createdStaff,
    role_created: roleResult.created,
  })
}

export function updateDemoStaff(id, staffMember) {
  const data = readDemoData()
  const staffId = String(id)
  const normalizedPhone = String(staffMember.phone || '').trim()
  const roleResult = ensureDemoRoleName(staffMember.role)

  if (
    data.staff.some(
      (currentStaff) =>
        currentStaff.is_deleted !== true &&
        String(currentStaff.id) !== staffId &&
        String(currentStaff.phone || '').trim() === normalizedPhone,
    )
  ) {
    createDemoError('Phone already registered')
  }

  let updatedStaff = null

  data.staff = data.staff.map((currentStaff) => {
    if (String(currentStaff.id) !== staffId || currentStaff.is_deleted === true) {
      return currentStaff
    }

    const nextStaffMember = {
      ...currentStaff,
      ...staffMember,
      age: Number(staffMember.age),
      address: staffMember.address || null,
      notes: staffMember.notes || null,
      shift_start: staffMember.shift_start || null,
      shift_end: staffMember.shift_end || null,
    }

    validateDemoStaff(nextStaffMember)
    updatedStaff = nextStaffMember

    return updatedStaff
  })

  if (!updatedStaff) {
    createDemoError('Staff member not found', 404)
  }

  writeDemoData(data)

  return clone({
    ...updatedStaff,
    role_created: roleResult.created,
  })
}

export function deleteDemoStaff(id) {
  const data = readDemoData()
  const staffId = String(id)
  let deletedStaff = null

  data.staff = data.staff.map((currentStaff) => {
    if (String(currentStaff.id) !== staffId || currentStaff.is_deleted === true) {
      return currentStaff
    }

    deletedStaff = {
      ...currentStaff,
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    }

    return deletedStaff
  })

  if (!deletedStaff) {
    createDemoError('Staff member not found', 404)
  }

  writeDemoData(data)

  return { id }
}

export function getDemoAppointments(params = {}) {
  const data = readDemoData()
  const normalizedParams = normalizeParams(params)
  let appointments = scopeAppointmentsForCurrentDoctor(data.appointments)

  if (normalizedParams.patient) {
    appointments = appointments.filter(
      (appointment) => String(appointment.patient) === String(normalizedParams.patient),
    )
  }

  if (normalizedParams.period === 'day') {
    appointments = appointments.filter((appointment) =>
      isSameDay(appointment.appointment_dt),
    )
  }

  if (normalizedParams.status) {
    appointments = appointments.filter(
      (appointment) =>
        String(appointment.status || '').toLowerCase() ===
        String(normalizedParams.status).toLowerCase(),
    )
  }

  appointments = sortAppointmentsByOrdering(appointments, normalizedParams.ordering)

  const decoratedAppointments = appointments.map((appointment) =>
    decorateAppointment(data, appointment),
  )

  return buildPagedResponse(decoratedAppointments, normalizedParams, '/appointments/')
}

export function getDemoAppointment(id) {
  const data = readDemoData()
  const appointment = data.appointments.find(
    (candidate) => String(candidate.id) === String(id),
  )

  if (
    !appointment ||
    !scopeAppointmentsForCurrentDoctor([appointment]).length
  ) {
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

// Doctor stats demo functions
export function getDemoDoctorStats(doctorId) {
  const data = readDemoData()

  if (!canCurrentDoctorAccessDoctorRecord(doctorId)) {
    createDemoError('Doctor not found', 404)
  }

  const doctor = data.doctors.find(
    (candidate) =>
      String(candidate.id) === String(doctorId) && candidate.is_active !== false,
  )

  if (!doctor) {
    createDemoError('Doctor not found', 404)
  }

  const doctorAppointments = data.appointments.filter(
    (appointment) =>
      String(appointment.doctor) === String(doctorId) &&
      appointment.status !== 'cancelled',
  )
  const dateKeys = getRecentDateKeys(30)
  const dailyCases = dateKeys.map((date, index) => ({
    date,
    count:
      countCasesForDate(doctorAppointments, date) ||
      ((Number(doctorId) + index) % 5 === 0 ? 2 : (Number(doctorId) + index) % 3),
  }))
  const monthlySummary = Array.from({ length: 12 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (11 - index), 1)
    const month = date.toISOString().slice(0, 7)
    const appointmentCount = doctorAppointments.filter(
      (appointment) => getDateKey(appointment.appointment_dt).slice(0, 7) === month,
    ).length

    return {
      month,
      count: appointmentCount || ((Number(doctorId) + index * 3) % 18) + 8,
    }
  })
  const caseTypes = [
    { type: 'Consultation', count: 45 },
    { type: 'Follow-up', count: 32 },
    { type: 'Surgery', count: 18 },
    { type: 'Emergency', count: 12 },
  ]
  const decoratedDoctor = decorateDoctor(data, doctor)

  return {
    avg_cases_per_day: Number(decoratedDoctor.avg_cases_per_day || 0),
    cases_this_week: Number(decoratedDoctor.cases_this_week || 0),
    cases_today: Number(decoratedDoctor.cases_today || 0),
    doctor_id: Number(doctorId),
    daily_cases: dailyCases,
    case_types: caseTypes,
    monthly_summary: monthlySummary,
    top_conditions: [
      { condition: 'Hypertension', count: 21 },
      { condition: 'Post-operative review', count: 17 },
      { condition: 'Diabetes', count: 14 },
      { condition: 'Respiratory symptoms', count: 9 },
      { condition: 'Preventive care', count: 8 },
    ],
  }
}

export function getDemoDoctorAppointments(doctorId, params = {}) {
  const data = readDemoData()

  if (!canCurrentDoctorAccessDoctorRecord(doctorId)) {
    createDemoError('Doctor not found', 404)
  }

  let appointments = data.appointments
    .filter((apt) => String(apt.doctor) === String(doctorId))
    .map((appointment) => decorateAppointment(data, appointment))

  // Apply filters
  const normalizedParams = normalizeParams(params)

  if (normalizedParams.status) {
    appointments = appointments.filter(
      (apt) =>
        String(apt.status || '').toLowerCase() ===
        String(normalizedParams.status).toLowerCase(),
    )
  }

  appointments = sortAppointmentsByOrdering(appointments, normalizedParams.ordering)

  return buildPagedResponse(
    appointments,
    {
      page: 1,
      page_size: 10,
      ...normalizedParams,
    },
    `/doctors/${doctorId}/appointments/`,
  )
}

export function resetDemoData() {
  const initialData = createInitialDemoData()
  writeDemoData(initialData)
  return clone(initialData)
}
