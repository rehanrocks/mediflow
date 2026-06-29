const CHAT_ROLES = ['admin', 'doctor', 'receptionist', 'staff']

const GROUP_ROLES = {
  admin: ['admin', 'doctor', 'receptionist', 'staff'],
  doctor: ['doctor', 'receptionist', 'staff'],
  receptionist: ['receptionist', 'doctor', 'staff'],
  staff: ['staff', 'doctor'],
}

export function normalizeRoleSlug(role) {
  const value = typeof role === 'string' ? role : role?.slug || role?.name || role?.role

  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

export function getUserId(user = {}) {
  return user?.user_id || user?.id || user?.pk
}

export function getDMableRoles() {
  return CHAT_ROLES
}

export function getGroupableRoles(role) {
  return GROUP_ROLES[normalizeRoleSlug(role)] || []
}

export function canCreateGroup(user) {
  return CHAT_ROLES.includes(normalizeRoleSlug(user?.role || user?.role_slug || user))
}

export function filterDMableUsers(users = [], currentUser = {}) {
  const currentUserId = getUserId(currentUser)

  return users.filter(
    (user) =>
      getUserId(user) !== currentUserId &&
      CHAT_ROLES.includes(normalizeRoleSlug(user.role || user.role_slug)),
  )
}

export function filterGroupableUsers(users = [], currentUser = {}) {
  const currentUserId = getUserId(currentUser)
  const allowedRoles = getGroupableRoles(currentUser.role || currentUser.role_slug)

  return users.filter(
    (user) =>
      getUserId(user) !== currentUserId &&
      allowedRoles.includes(normalizeRoleSlug(user.role || user.role_slug)),
  )
}
