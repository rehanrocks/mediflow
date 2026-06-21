/* src/lib/seedData.js - Temporary local demo data for frontend-only testing. */
const DEMO_STORAGE_KEY = 'mediflow_demo_data_v2'

const PATIENTS = [
  {
    id: 101,
    full_name: 'Maria Garcia',
    phone: '+1 555 0142',
    age: 46,
    condition: 'Post-op hip replacement',
  },
  {
    id: 102,
    full_name: 'Robert Johnson',
    phone: '+1 555 0188',
    age: 58,
    condition: 'Diabetes follow-up',
  },
  {
    id: 103,
    full_name: 'Aisha Khan',
    phone: '+1 555 0107',
    age: 34,
    condition: 'Hypertension review',
  },
  {
    id: 104,
    full_name: 'Daniel Turner',
    phone: '+1 555 0194',
    age: 41,
    condition: 'Annual wellness visit',
  },
  {
    id: 105,
    full_name: 'Mei Lin',
    phone: '+1 555 0166',
    age: 29,
    condition: 'Respiratory symptoms',
  },
  {
    id: 106,
    full_name: 'Omar Hassan',
    phone: '+1 555 0125',
    age: 63,
    condition: 'Cardiology consult',
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
      appointment_dt: addDays(-5, 9, 30),
      reason: 'Surgical recovery review',
      status: 'completed',
    },
    {
      id: 302,
      patient: 102,
      doctor: 202,
      appointment_dt: addDays(-3, 11),
      reason: 'Glucose control check',
      status: 'completed',
    },
    {
      id: 303,
      patient: 103,
      doctor: 201,
      appointment_dt: addDays(-1, 14, 15),
      reason: 'Blood pressure follow-up',
      status: 'in_progress',
    },
    {
      id: 304,
      patient: 104,
      doctor: 203,
      appointment_dt: addDays(0, 10, 30),
      reason: 'Routine physical',
      status: 'scheduled',
    },
    {
      id: 305,
      patient: 105,
      doctor: 202,
      appointment_dt: addDays(0, 13),
      reason: 'Cough and breathing concerns',
      status: 'scheduled',
    },
    {
      id: 306,
      patient: 106,
      doctor: 203,
      appointment_dt: addDays(1, 15, 45),
      reason: 'Cardiology intake',
      status: 'scheduled',
    },
    {
      id: 307,
      patient: 101,
      doctor: 201,
      appointment_dt: addDays(2, 9),
      reason: 'Mobility progress check',
      status: 'cancelled',
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

export function getDemoPatients(search = '') {
  const term = search.trim().toLowerCase()
  const patients = readDemoData().patients

  if (!term) {
    return clone(patients)
  }

  return clone(
    patients.filter((patient) => {
      const name = patient.full_name.toLowerCase()
      const phone = patient.phone.toLowerCase()

      return name.includes(term) || phone.includes(term)
    }),
  )
}

export function createDemoPatient(patient) {
  const data = readDemoData()
  const createdPatient = {
    id: getNextId(data.patients),
    full_name: patient.full_name,
    phone: patient.phone,
    age: Number(patient.age),
    condition: patient.condition || '',
  }

  data.patients = [createdPatient, ...data.patients]
  writeDemoData(data)

  return clone(createdPatient)
}

export function updateDemoPatient(id, patient) {
  const data = readDemoData()
  const patientId = String(id)
  let updatedPatient = null

  data.patients = data.patients.map((currentPatient) => {
    if (String(currentPatient.id) !== patientId) {
      return currentPatient
    }

    updatedPatient = {
      ...currentPatient,
      full_name: patient.full_name,
      phone: patient.phone,
      age: Number(patient.age),
      condition: patient.condition || '',
    }

    return updatedPatient
  })

  writeDemoData(data)

  return clone(updatedPatient || { id, ...patient })
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

export function getDemoAppointments() {
  return clone(readDemoData().appointments)
}

export function bookDemoAppointment(appointment) {
  const data = readDemoData()
  const bookedAppointment = {
    id: getNextId(data.appointments),
    patient: Number(appointment.patient),
    doctor: Number(appointment.doctor),
    appointment_dt: appointment.appointment_dt,
    reason: appointment.reason || '',
    status: 'scheduled',
  }

  data.appointments = [bookedAppointment, ...data.appointments]
  writeDemoData(data)

  return clone(bookedAppointment)
}

export function updateDemoStatus(id, status) {
  const data = readDemoData()
  const appointmentId = String(id)
  let updatedAppointment = null

  data.appointments = data.appointments.map((appointment) => {
    if (String(appointment.id) !== appointmentId) {
      return appointment
    }

    updatedAppointment = {
      ...appointment,
      status,
    }

    return updatedAppointment
  })

  writeDemoData(data)

  return clone(updatedAppointment || { id, status })
}

export function resetDemoData() {
  const initialData = createInitialDemoData()
  writeDemoData(initialData)
  return clone(initialData)
}
