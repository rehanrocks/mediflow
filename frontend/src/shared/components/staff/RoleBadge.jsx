/* src/shared/components/staff/RoleBadge.jsx - Stable color chip for free-text staff roles. */

const ROLE_COLORS = [
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  { bg: 'bg-brand-light', text: 'text-brand', border: 'border-brand/20' },
]

const UNASSIGNED_COLOR = {
  bg: 'bg-slate-100',
  text: 'text-slate-500',
  border: 'border-slate-200',
}

function getRoleColor(role) {
  const hash = [...role].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  )

  return ROLE_COLORS[hash % ROLE_COLORS.length]
}

export function RoleBadge({ role }) {
  const normalizedRole = String(role || '').trim()
  const label = normalizedRole || 'Unassigned'
  const color = normalizedRole ? getRoleColor(normalizedRole) : UNASSIGNED_COLOR

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-sans text-[11px] font-medium',
        color.bg,
        color.text,
        color.border,
      ].join(' ')}
    >
      {label}
    </span>
  )
}

export default RoleBadge
