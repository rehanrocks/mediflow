export const ACCESS_LEVELS = [
  {
    chipClass: 'bg-slate-100 text-slate border-slate-200',
    label: 'No Access',
    value: 'no_access',
  },
  {
    chipClass: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Read',
    value: 'read',
  },
  {
    chipClass: 'bg-green-50 text-green-700 border-green-200',
    label: 'Full Access',
    value: 'full_access',
  },
]

export const ACCESS_LEVEL_VALUES = ACCESS_LEVELS.map((level) => level.value)

export function normalizeAccessLevel(level) {
  const value = String(level || '').trim().toLowerCase()

  if (value === 'none') return 'no_access'
  if (value === 'write') return 'full_access'
  if (value === 'both') return 'full_access'
  if (value === 'read_write') return 'full_access'

  return ACCESS_LEVEL_VALUES.includes(value) ? value : 'no_access'
}

export function getAccessLevelMeta(level) {
  const normalizedLevel = normalizeAccessLevel(level)

  return (
    ACCESS_LEVELS.find((accessLevel) => accessLevel.value === normalizedLevel) ||
    ACCESS_LEVELS[0]
  )
}

export function canReadAccessLevel(level) {
  return ['read', 'full_access'].includes(normalizeAccessLevel(level))
}

export function canWriteAccessLevel(level) {
  return normalizeAccessLevel(level) === 'full_access'
}
