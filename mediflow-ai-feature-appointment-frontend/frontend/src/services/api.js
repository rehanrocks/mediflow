import axios from 'axios'

import {
  bookDemoAppointment,
  createDemoPatient,
  getDemoAppointments,
  getDemoDoctors,
  getDemoPatients,
  updateDemoPatient,
  deleteDemoPatient,
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

export async function getPatients(search = '') {
  return withDemoFallback(
    async () => {
      const { data } = await api.get('/patients/', {
        params: search ? { search } : {},
      })
      return data
    },
    () => getDemoPatients(search),
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
      await api.delete(`/patients/${id}/`)
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

export async function getAppointments() {
  return withDemoFallback(
    async () => {
      const { data } = await api.get('/appointments/')
      return data
    },
    getDemoAppointments,
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
