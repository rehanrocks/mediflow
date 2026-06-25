import axios from 'axios'

import {
  bookDemoAppointment,
  createDemoDoctor,
  createDemoPatient,
  createDemoStaff,
  deleteDemoAppointment,
  deleteDemoDoctor,
  deleteDemoPatient,
  deleteDemoStaff,
  getDemoAppointment,
  getDemoAppointments,
  getDemoDoctorAppointments,
  getDemoDoctorById,
  getDemoDoctors,
  getDemoDoctorStats,
  getDemoPatient,
  getDemoPatients,
  getDemoStaff,
  getDemoStaffById,
  updateDemoAppointment,
  updateDemoDoctor,
  updateDemoPatient,
  updateDemoPayment,
  updateDemoStaff,
  updateDemoStatus,
} from '@shared/lib/seedData'

import {
  getDemoRoles,
  createDemoRole,
  updateDemoRole,
  deleteDemoRole,
  setDemoRolePermissions,
  getDemoRoleNames,
  ensureDemoRoleName,
} from '@shared/lib/accessControlData'

export const api = axios.create({
  baseURL: 'http://localhost:8000/api',
})

function getAccessToken() {
  return (
    localStorage.getItem('access_token') ||
    localStorage.getItem('access')
  )
}

function getDetailMessage(error) {
  const detail = error?.response?.data?.detail

  if (typeof detail === 'string') {
    return detail
  }

  return ''
}

function isFeatureRestriction(detail) {
  const message = detail.toLowerCase()

  return (
    message.includes('plan') ||
    message.includes('subscription') ||
    message.includes('feature not enabled') ||
    message.includes('feature is not enabled') ||
    message.includes('feature disabled') ||
    message.includes('feature is disabled') ||
    message.includes('not enabled for your org') ||
    message.includes('not enabled for your organization') ||
    message.includes('enable this feature') ||
    message.includes('ask your admin to enable')
  )
}

function canUseBackend() {
  return Boolean(getAccessToken())
}

function shouldUseDemoFallback(error) {
  return !canUseBackend() || !error?.response
}

async function withDemoFallback(request, fallback) {
  if (!canUseBackend()) {
    return fallback()
  }

  try {
    return await request()
  } catch (error) {
    if (shouldUseDemoFallback(error)) {
      return fallback()
    }

    throw error
  }
}

function normalizeParams(params = '') {
  if (typeof params === 'string') {
    return params.trim() ? { search: params.trim() } : {}
  }

  return params || {}
}

export function getList(response) {
  if (Array.isArray(response)) {
    return response
  }

  if (Array.isArray(response?.results)) {
    return response.results
  }

  return []
}

api.interceptors.request.use((config) => {
  const access = getAccessToken()

  if (access) {
    config.headers.Authorization = `Bearer ${access}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = getDetailMessage(error)

    if (error?.response?.status === 403) {
      const path = error.config?.url || ''

      error.detail = detail
      error.featureBlocked = isFeatureRestriction(detail)

      if (path.includes('/staff/')) {
        window.location.href = '/not-available?reason=role'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

export async function login(email, password) {
  const { data } = await api.post('/auth/login/', { email, password })
  return data
}

export async function refreshToken(refreshTokenValue) {
  const { data } = await api.post('/auth/refresh/', {
    refresh_token: refreshTokenValue,
  })
  return data
}

// DOCTOR ROLE — automatic server-side scoping (no frontend param needed):
// GET /api/patients/          → returns only patients who have had appointments with this doctor
// GET /api/appointments/      → returns only this doctor's appointments
// GET /api/doctors/:id/stats/ → returns only if :id matches doctor's own user_id
// GET /api/staff/             → 403 Forbidden (doctor has no staff access)
//
// RECEPTIONIST ROLE:
// GET /api/patients/          → all patients (no scoping)
// GET /api/appointments/      → all appointments (no scoping)
// POST /api/doctors/          → allowed (receptionist can add doctors)
// POST /api/patients/         → allowed (receptionist can add patients)
// POST /api/appointments/     → allowed (receptionist can book appointments)
// GET /api/staff/             → 403 Forbidden (staff module is admin-only)
//
// ADMIN:
// Full access with no role-based scoping, including /api/staff/
export async function getPatients(params = '') {
  const normalizedParams = normalizeParams(params)

  return withDemoFallback(
    async () => {
      const { data } = await api.get('/patients/', {
        params: normalizedParams,
      })
      return data
    },
    () => getDemoPatients(normalizedParams),
  )
}

export async function getPatient(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.get(`/patients/${id}/`)
      return data
    },
    () => getDemoPatient(id),
  )
}

export async function createPatient(patient) {
  return withDemoFallback(
    async () => {
      const { data } = await api.post('/patients/', patient)
      return data
    },
    () => createDemoPatient(patient),
  )
}

export async function updatePatient(id, patient) {
  return withDemoFallback(
    async () => {
      const { data } = await api.patch(`/patients/${id}/`, patient)
      return data
    },
    () => updateDemoPatient(id, patient),
  )
}

export async function deletePatient(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.delete(`/patients/${id}/`)
      return data
    },
    () => deleteDemoPatient(id),
  )
}

export async function getDoctors(params = {}) {
  const normalizedParams = normalizeParams(params)

  return withDemoFallback(
    async () => {
      const { data } = await api.get('/doctors/', {
        params: normalizedParams,
      })
      return data
    },
    () => getDemoDoctors(normalizedParams),
  )
}

export async function getDoctorById(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.get(`/doctors/${id}/`)
      return data
    },
    () => getDemoDoctorById(id),
  )
}

export async function createDoctor(doctorData) {
  return withDemoFallback(
    async () => {
      const { data } = await api.post('/doctors/', doctorData)
      return data
    },
    () => createDemoDoctor(doctorData),
  )
}

export async function updateDoctor(id, doctorData) {
  return withDemoFallback(
    async () => {
      const { data } = await api.put(`/doctors/${id}/`, doctorData)
      return data
    },
    () => updateDemoDoctor(id, doctorData),
  )
}

export async function deleteDoctor(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.delete(`/doctors/${id}/`)
      return data
    },
    () => deleteDemoDoctor(id),
  )
}

export async function getStaff(params = {}) {
  const normalizedParams = normalizeParams(params)

  return withDemoFallback(
    async () => {
      const { data } = await api.get('/staff/', {
        params: normalizedParams,
      })
      return data
    },
    () => getDemoStaff(normalizedParams),
  )
}

export async function getStaffById(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.get(`/staff/${id}/`)
      return data
    },
    () => getDemoStaffById(id),
  )
}

export async function createStaff(staffData) {
  return withDemoFallback(
    async () => {
      const { data } = await api.post('/staff/', staffData)
      return data
    },
    () => createDemoStaff(staffData),
  )
}

export async function updateStaff(id, staffData) {
  return withDemoFallback(
    async () => {
      const { data } = await api.put(`/staff/${id}/`, staffData)
      return data
    },
    () => updateDemoStaff(id, staffData),
  )
}

export async function deleteStaff(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.delete(`/staff/${id}/`)
      return data
    },
    () => deleteDemoStaff(id),
  )
}

export async function getDoctorStats(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.get(`/doctors/${id}/stats/`)
      return data
    },
    () => getDemoDoctorStats(id),
  )
}

export async function getDoctorAppointments(id, params = {}) {
  const normalizedParams = normalizeParams(params)

  return withDemoFallback(
    async () => {
      const { data } = await api.get(`/doctors/${id}/appointments/`, {
        params: normalizedParams,
      })
      return data
    },
    () => getDemoDoctorAppointments(id, params),
  )
}

export async function getAppointments(params = {}) {
  const normalizedParams = normalizeParams(params)

  return withDemoFallback(
    async () => {
      const { data } = await api.get('/appointments/', {
        params: normalizedParams,
      })
      return data
    },
    () => getDemoAppointments(normalizedParams),
  )
}

export async function getAppointment(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.get(`/appointments/${id}/`)
      return data
    },
    () => getDemoAppointment(id),
  )
}

export async function bookAppointment(appointment) {
  return withDemoFallback(
    async () => {
      const { data } = await api.post('/appointments/', appointment)
      return data
    },
    () => bookDemoAppointment(appointment),
  )
}

export async function updateAppointment(id, appointment) {
  return withDemoFallback(
    async () => {
      const { data } = await api.patch(`/appointments/${id}/`, appointment)
      return data
    },
    () => updateDemoAppointment(id, appointment),
  )
}

export async function deleteAppointment(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.delete(`/appointments/${id}/`)
      return data
    },
    () => deleteDemoAppointment(id),
  )
}

export async function updateStatus(id, status) {
  return withDemoFallback(
    async () => {
      const { data } = await api.patch(`/appointments/${id}/update_status/`, {
        status,
      })
      return data
    },
    () => updateDemoStatus(id, status),
  )
}

export async function updatePaymentStatus(id, paymentStatus) {
  return withDemoFallback(
    async () => {
      const { data } = await api.patch(`/appointments/${id}/`, {
        payment_status: paymentStatus,
      })
      return data
    },
    () => updateDemoPayment(id, paymentStatus),
  )
}

export async function getRoles() {
  return withDemoFallback(
    async () => {
      const { data } = await api.get('/access-control/roles/')
      return data
    },
    () => getDemoRoles(),
  )
}

export async function getRoleById(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.get(`/access-control/roles/${id}/`)
      return data
    },
    () => {
      const roles = getDemoRoles()
      return roles.find((r) => String(r.id) === String(id)) || null
    },
  )
}

export async function createRole(roleData) {
  return withDemoFallback(
    async () => {
      const { data } = await api.post('/access-control/roles/', roleData)
      return data
    },
    () => createDemoRole(roleData),
  )
}

export async function updateRole(id, roleData) {
  return withDemoFallback(
    async () => {
      const { data } = await api.put(`/access-control/roles/${id}/`, roleData)
      return data
    },
    () => updateDemoRole(id, roleData),
  )
}

export async function deleteRole(id) {
  return withDemoFallback(
    async () => {
      const { data } = await api.delete(`/access-control/roles/${id}/`)
      return data
    },
    () => deleteDemoRole(id),
  )
}

export async function setRolePermissions(id, payload) {
  return withDemoFallback(
    async () => {
      const { data } = await api.post(
        `/access-control/roles/${id}/set-permissions/`,
        payload,
      )
      return data
    },
    () => setDemoRolePermissions(id, payload),
  )
}

export async function getRoleNames() {
  return withDemoFallback(
    async () => {
      const { data } = await api.get('/access-control/role-names/')
      return data
    },
    () => getDemoRoleNames(),
  )
}

export async function ensureRoleName(name) {
  return withDemoFallback(
    async () => {
      const { data } = await api.post('/access-control/roles/from-staff/', {
        role_name: name,
      })
      return data
    },
    () => ensureDemoRoleName(name),
  )
}
