import axios from 'axios'

import {
  createDemoRole,
  deleteDemoRole,
  getDemoRoleById,
  getDemoRoleNames,
  getDemoRoles,
  setDemoRolePermissions,
  updateDemoRole,
} from '@shared/lib/accessControlData'
import { PUBLIC_ROUTES_FOR_TESTING } from '@shared/lib/testingAccess'
import {
  bookDemoAppointment,
  createDemoDoctor,
  createDemoPatient,
  createDemoQualification,
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
  getDemoQualifications,
  getDemoStaff,
  getDemoStaffById,
  updateDemoAppointment,
  updateDemoDoctor,
  updateDemoPatient,
  updateDemoPayment,
  updateDemoStaff,
  updateDemoStatus,
} from '@shared/lib/seedData'

export const api = axios.create({
  baseURL: 'http://localhost:8000/api',
})

const authSyncHandlers = {
  getRefreshToken: () =>
    localStorage.getItem('refresh_token') || localStorage.getItem('refresh') || '',
  onSessionExpired: () => {},
  onSessionSync: () => {},
}

export function configureAuthSync(handlers = {}) {
  Object.assign(authSyncHandlers, handlers)
}

function dispatchToast(type, message) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('mediflow:toast', {
      detail: { message, type },
    }),
  )
}

function getAccessToken() {
  if (PUBLIC_ROUTES_FOR_TESTING) {
    return ''
  }

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

function isWriteMethod(method = '') {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
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
  async (error) => {
    const detail = getDetailMessage(error)

    if (
      !PUBLIC_ROUTES_FOR_TESTING &&
      error?.response?.status === 401 &&
      !error.config?._retried &&
      !String(error.config?.url || '').includes('/auth/refresh/')
    ) {
      const refreshTokenValue = authSyncHandlers.getRefreshToken()

      if (refreshTokenValue) {
        try {
          error.config._retried = true
          const data = await refreshToken(refreshTokenValue)
          const accessToken = data?.access_token ?? data?.access

          if (accessToken) {
            localStorage.setItem('access_token', accessToken)
            localStorage.removeItem('access')
            error.config.headers = {
              ...error.config.headers,
              Authorization: `Bearer ${accessToken}`,
            }
          }

          authSyncHandlers.onSessionSync(data)

          return api(error.config)
        } catch (refreshError) {
          authSyncHandlers.onSessionExpired()
          return Promise.reject(refreshError)
        }
      }
    }

    if (!PUBLIC_ROUTES_FOR_TESTING && error?.response?.status === 403) {
      const method = error.config?.method || ''

      error.detail = detail
      error.featureBlocked = isFeatureRestriction(detail)

      if (isWriteMethod(method)) {
        dispatchToast(
          'error',
          detail || 'You do not have permission to perform this action.',
        )
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
    refresh_token:
      refreshTokenValue ||
      localStorage.getItem('refresh_token') ||
      localStorage.getItem('refresh'),
  })
  return data
}

export async function changePassword(newPassword, confirmPassword) {
  return withDemoFallback(
    async () => {
      const { data } = await api.post('/auth/change-password/', {
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      return data
    },
    () => ({ detail: 'Password updated successfully.' }),
  )
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

export async function getQualifications() {
  return withDemoFallback(
    async () => {
      const { data } = await api.get('/qualifications/')
      return data
    },
    () => getDemoQualifications(),
  )
}

export async function createQualification(name) {
  return withDemoFallback(
    async () => {
      const { data } = await api.post('/qualifications/', { name })
      return data
    },
    () => createDemoQualification(name),
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

export async function getRoleById(roleId) {
  return withDemoFallback(
    async () => {
      const { data } = await api.get(`/access-control/roles/${roleId}/`)
      return data
    },
    () => getDemoRoleById(roleId),
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

export async function updateRole(roleId, roleData) {
  return withDemoFallback(
    async () => {
      const { data } = await api.put(`/access-control/roles/${roleId}/`, roleData)
      return data
    },
    () => updateDemoRole(roleId, roleData),
  )
}

export async function deleteRole(roleId) {
  return withDemoFallback(
    async () => {
      const { data } = await api.delete(`/access-control/roles/${roleId}/`)
      return data
    },
    () => deleteDemoRole(roleId),
  )
}

export async function setRolePermissions(roleId, payload) {
  return withDemoFallback(
    async () => {
      const { data } = await api.post(
        `/access-control/roles/${roleId}/set-permissions/`,
        payload,
      )
      return data
    },
    () => setDemoRolePermissions(roleId, payload),
  )
}

export async function updateRolePermissions(roleId, permissions) {
  return setRolePermissions(roleId, { permissions })
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
