/* src/shared/lib/testingAccess.js - Temporary auth bypass for local QA. */
export const PUBLIC_ROUTES_FOR_TESTING = false

const TESTING_ROLE_STORAGE_KEY = 'mediflow_testing_role'

export const FULL_ACCESS_PERMISSIONS = {
  appointments: 'full_access',
  doctors: 'full_access',
  patients: 'full_access',
  reports: 'full_access',
  staff: 'full_access',
}

const TESTING_SESSIONS = {
  admin: {
    permissions: FULL_ACCESS_PERMISSIONS,
    role: {
      id: 1,
      is_system: true,
      name: 'Admin',
      slug: 'admin',
    },
    user: {
      id: 1,
      email: 'admin.testing@mediflow.local',
      first_name: 'MediFlow',
      full_name: 'MediFlow Admin',
      last_name: 'Admin',
      organization_name: 'Clinic workspace',
    },
  },
  doctor: {
    permissions: {
      appointments: 'read',
      doctors: 'read',
      patients: 'read',
      reports: 'no_access',
      staff: 'no_access',
    },
    role: {
      id: 2,
      is_system: true,
      name: 'Doctor',
      slug: 'doctor',
    },
    user: {
      id: 201,
      user_id: 201,
      doctor_id: 201,
      email: 'doctor.testing@mediflow.local',
      first_name: 'Nora',
      full_name: 'Nora Patel',
      last_name: 'Patel',
      organization_name: 'Clinic workspace',
    },
  },
  receptionist: {
    permissions: {
      appointments: 'full_access',
      doctors: 'full_access',
      patients: 'full_access',
      reports: 'read',
      staff: 'no_access',
    },
    role: {
      id: 3,
      is_system: true,
      name: 'Receptionist',
      slug: 'receptionist',
    },
    user: {
      id: 401,
      email: 'reception.testing@mediflow.local',
      first_name: 'Dana',
      full_name: 'Dana Teller',
      last_name: 'Teller',
      organization_name: 'Clinic workspace',
    },
  },
}

function getTestingRoleFromPath() {
  if (typeof window === 'undefined') {
    return ''
  }

  const pathname = window.location.pathname

  if (pathname.startsWith('/dashboard/doctor')) {
    return 'doctor'
  }

  return ''
}

export function getPublicTestingSession() {
  if (!PUBLIC_ROUTES_FOR_TESTING) {
    return null
  }

  const routeRole = getTestingRoleFromPath()
  let storedRole

  try {
    storedRole = localStorage.getItem(TESTING_ROLE_STORAGE_KEY) || ''
  } catch {
    storedRole = ''
  }

  return (
    TESTING_SESSIONS[routeRole] ||
    TESTING_SESSIONS[storedRole] ||
    TESTING_SESSIONS.admin
  )
}

export function getPublicTestingUser() {
  return getPublicTestingSession()?.user || null
}
