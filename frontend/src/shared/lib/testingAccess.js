/* src/shared/lib/testingAccess.js - Temporary auth bypass for local QA. */
import { ROLES } from './roles'

export const PUBLIC_ROUTES_FOR_TESTING = false

const TESTING_ROLE_STORAGE_KEY = 'mediflow_testing_role'

const TESTING_FEATURES = ['appointments', 'patients', 'doctors', 'staff']

const TESTING_USERS = {
  [ROLES.ADMIN]: {
    id: 1,
    email: 'admin.testing@mediflow.local',
    first_name: 'MediFlow',
    full_name: 'MediFlow Admin',
    last_name: 'Admin',
    role: ROLES.ADMIN,
    organization_name: 'Clinic workspace',
    enabled_features: TESTING_FEATURES,
  },
  [ROLES.DOCTOR]: {
    id: 201,
    user_id: 201,
    doctor_id: 201,
    email: 'doctor.testing@mediflow.local',
    first_name: 'Nora',
    full_name: 'Nora Patel',
    last_name: 'Patel',
    role: ROLES.DOCTOR,
    organization_name: 'Clinic workspace',
    enabled_features: TESTING_FEATURES,
  },
  [ROLES.RECEPTIONIST]: {
    id: 401,
    email: 'reception.testing@mediflow.local',
    first_name: 'Dana',
    full_name: 'Dana Teller',
    last_name: 'Teller',
    role: ROLES.RECEPTIONIST,
    organization_name: 'Clinic workspace',
    enabled_features: TESTING_FEATURES,
  },
}

function getTestingRoleFromPath() {
  if (typeof window === 'undefined') {
    return ''
  }

  const pathname = window.location.pathname

  if (pathname.startsWith('/dashboard/admin')) {
    return ROLES.ADMIN
  }

  if (pathname.startsWith('/dashboard/doctor')) {
    return ROLES.DOCTOR
  }

  return ''
}

export function getPublicTestingUser() {
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

  return TESTING_USERS[routeRole] || TESTING_USERS[storedRole] || TESTING_USERS[ROLES.DOCTOR]
}
