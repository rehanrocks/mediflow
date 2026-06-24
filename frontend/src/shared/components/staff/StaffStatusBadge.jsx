/* src/shared/components/staff/StaffStatusBadge.jsx - Status badge for staff. */

const STATUS_CONFIG = {
  active: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    dotColor: 'bg-green-500',
    dotClass: 'animate-pulse',
    label: 'Active',
  },
  inactive: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dotColor: '',
    dotClass: '',
    label: 'Inactive',
  },
}

export function StaffStatusBadge({ status }) {
  const normalizedStatus = status === 'active' ? 'active' : 'inactive'
  const config = STATUS_CONFIG[normalizedStatus]

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 font-mono text-[11px] uppercase tracking-wide',
        config.bg,
        config.text,
        config.border,
      ].join(' ')}
    >
      {config.dotColor ? (
        <span
          className={['inline-block h-2 w-2 rounded-full', config.dotColor, config.dotClass].join(
            ' ',
          )}
        />
      ) : null}
      {config.label}
    </span>
  )
}

export default StaffStatusBadge
