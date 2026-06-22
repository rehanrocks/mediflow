import axios from 'axios'

import {
  bookDemoAppointment,
  createDemoPatient,
  deleteDemoAppointment,
  deleteDemoPatient,
  getDemoAppointment,
  getDemoAppointments,
  getDemoDoctors,
  getDemoPatient,
  getDemoPatients,
  updateDemoAppointment,
  updateDemoPatient,
  updateDemoPayment,
  updateDemoStatus,
} from '../lib/seedData'

export const api = axios.create({
  baseURL: 'http://localhost:8000/api',
})

function getAccessToken() {
  return localStorage.getItem('access')
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
      error.detail = detail
      error.featureBlocked = isFeatureRestriction(detail)
    }

    return Promise.reject(error)
  },
)

export async function login(credentials) {
  const { data } = await api.post('/auth/login/', credentials)
  return data
}

export async function refreshToken(refresh) {
  const { data } = await api.post('/auth/refresh/', { refresh })
  return data
}

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

export async function getDoctors() {
  return withDemoFallback(
    async () => {
      const { data } = await api.get('/doctors/')
      return data
    },
    getDemoDoctors,
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
