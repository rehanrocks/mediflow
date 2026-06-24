const MODULES = ['patients', 'appointments', 'doctors', 'staff', 'reports']
const ACCESS_LEVELS = ['none', 'read', 'write', 'both']

const DEMO_ROLE_RECORDS = [
  {
    created_at: '2024-01-01T08:00:00.000Z',
    description: 'Full platform administrator.',
    id: 1,
    is_system: true,
    module_permissions: {
      appointments: 'both',
      doctors: 'both',
      patients: 'both',
      reports: 'read',
      staff: 'both',
    },
    name: 'Admin',
    slug: 'admin',
    user_count: 1,
  },
  {
    created_at: '2024-01-01T08:00:00.000Z',
    description: 'Clinician with personally scoped clinical data.',
    id: 2,
    is_system: true,
    module_permissions: {
      appointments: 'read',
      doctors: 'read',
      patients: 'read',
      reports: 'none',
      staff: 'none',
    },
    name: 'Doctor',
    slug: 'doctor',
    user_count: 3,
  },
  {
    created_at: '2024-01-01T08:00:00.000Z',
    description: 'Front desk appointment and patient operations.',
    id: 3,
    is_system: true,
    module_permissions: {
      appointments: 'both',
      doctors: 'both',
      patients: 'both',
      reports: 'read',
      staff: 'none',
    },
    name: 'Receptionist',
    slug: 'receptionist',
    user_count: 1,
  },
  {
    created_at: '2024-04-08T09:10:00.000Z',
    description: 'Senior nursing workflow oversight.',
    id: 11,
    is_system: false,
    module_permissions: {
      appointments: 'both',
      doctors: 'read',
      patients: 'both',
      reports: 'read',
      staff: 'none',
    },
    name: 'Head Nurse',
    slug: 'head-nurse',
    user_count: 0,
  },
  {
    created_at: '2024-05-11T11:20:00.000Z',
    description: 'Diagnostic lab visibility.',
    id: 12,
    is_system: false,
    module_permissions: {
      appointments: 'read',
      doctors: 'none',
      patients: 'read',
      reports: 'read',
      staff: 'none',
    },
    name: 'Lab Technician',
    slug: 'lab-technician',
    user_count: 0,
  },
]

let demoRoles = DEMO_ROLE_RECORDS.map((role) => normalizeRole(role))

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getPermissionMap(role = {}) {
  return role.module_permissions || role.permissions || {}
}

function normalizePermissions(permissions = {}) {
  return MODULES.reduce((nextPermissions, module) => {
    const access = permissions[module] || 'none'
    nextPermissions[module] = ACCESS_LEVELS.includes(access) ? access : 'none'
    return nextPermissions
  }, {})
}

function normalizeRole(role) {
  const modulePermissions = normalizePermissions(getPermissionMap(role))

  return {
    created_at: role.created_at || new Date().toISOString(),
    description: role.description || '',
    id: Number(role.id),
    is_system: role.is_system === true,
    module_permissions: modulePermissions,
    name: String(role.name || '').trim(),
    permissions: modulePermissions,
    slug: role.slug || slugify(role.name),
    user_count: Number(role.user_count || 0),
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function getNextRoleId() {
  return Math.max(0, ...demoRoles.map((role) => Number(role.id) || 0)) + 1
}

function createDemoError(detail, status = 400) {
  const error = new Error(detail)
  error.response = {
    data: { detail },
    status,
  }
  throw error
}

function validateRoleName(name, currentId = null) {
  const trimmedName = String(name || '').trim()

  if (!trimmedName) {
    createDemoError('Role name is required.')
  }

  if (trimmedName.length < 2) {
    createDemoError('Role name must be at least 2 characters.')
  }

  const duplicate = demoRoles.find(
    (role) =>
      String(role.id) !== String(currentId) &&
      role.name.toLowerCase() === trimmedName.toLowerCase(),
  )

  if (duplicate) {
    createDemoError('A role with this name already exists.')
  }

  return trimmedName
}

function permissionsArrayToMap(permissions = []) {
  if (!Array.isArray(permissions)) {
    return normalizePermissions(permissions)
  }

  return normalizePermissions(
    permissions.reduce((nextPermissions, permission) => {
      nextPermissions[permission.module] = permission.access
      return nextPermissions
    }, {}),
  )
}

export function getDemoRoles() {
  return clone(demoRoles.map(normalizeRole))
}

export function getDemoRoleById(roleId) {
  const role = demoRoles.find((candidate) => String(candidate.id) === String(roleId))

  if (!role) {
    createDemoError('Role not found.', 404)
  }

  return clone(normalizeRole(role))
}

export function createDemoRole(roleData = {}) {
  const name = validateRoleName(roleData.name)
  const role = normalizeRole({
    created_at: new Date().toISOString(),
    description: roleData.description || '',
    id: getNextRoleId(),
    is_system: false,
    module_permissions: normalizePermissions(),
    name,
    slug: slugify(name),
    user_count: 0,
  })

  demoRoles = [...demoRoles, role]
  return clone(role)
}

export function updateDemoRole(roleId, roleData = {}) {
  let updatedRole = null

  demoRoles = demoRoles.map((role) => {
    if (String(role.id) !== String(roleId)) {
      return role
    }

    if (role.is_system) {
      createDemoError('System role names cannot be changed.')
    }

    const name = validateRoleName(roleData.name, roleId)
    updatedRole = normalizeRole({
      ...role,
      description: roleData.description || '',
      name,
      slug: role.slug || slugify(name),
    })

    return updatedRole
  })

  if (!updatedRole) {
    createDemoError('Role not found.', 404)
  }

  return clone(updatedRole)
}

export function deleteDemoRole(roleId) {
  const role = demoRoles.find((candidate) => String(candidate.id) === String(roleId))

  if (!role) {
    createDemoError('Role not found.', 404)
  }

  if (role.is_system) {
    createDemoError('System roles cannot be deleted.')
  }

  if (Number(role.user_count || 0) > 0) {
    createDemoError('Cannot delete a role that is assigned to active users. Reassign those users first.')
  }

  demoRoles = demoRoles.filter((candidate) => String(candidate.id) !== String(roleId))
  return { id: roleId }
}

export function setDemoRolePermissions(roleId, payload = {}) {
  const nextPermissions = permissionsArrayToMap(payload.permissions || payload)
  let updatedRole = null

  demoRoles = demoRoles.map((role) => {
    if (String(role.id) !== String(roleId)) {
      return role
    }

    updatedRole = normalizeRole({
      ...role,
      module_permissions: nextPermissions,
    })

    return updatedRole
  })

  if (!updatedRole) {
    createDemoError('Role not found.', 404)
  }

  return clone(updatedRole)
}

export function updateDemoRolePermissions(roleId, permissions) {
  return setDemoRolePermissions(roleId, { permissions })
}

export function getDemoRoleNames() {
  return clone(
    demoRoles.map((role) => ({
      id: role.id,
      is_system: role.is_system,
      name: role.name,
      slug: role.slug,
    })),
  )
}

export function ensureDemoRoleName(name) {
  const trimmedName = String(name || '').trim()

  if (!trimmedName) {
    return { created: false, role: null }
  }

  const existingRole = demoRoles.find(
    (role) => role.name.toLowerCase() === trimmedName.toLowerCase(),
  )

  if (existingRole) {
    return { created: false, role: clone(existingRole) }
  }

  return {
    created: true,
    role: createDemoRole({ name: trimmedName }),
  }
}

export { ACCESS_LEVELS, MODULES }
