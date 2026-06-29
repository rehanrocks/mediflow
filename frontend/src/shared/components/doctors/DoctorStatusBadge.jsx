/* src/shared/components/doctors/DoctorStatusBadge.jsx - Status badge for doctors. */

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
  on_leave: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dotColor: 'bg-amber-400',
    dotClass: '',
    label: 'On Leave',
  },
}

export function DoctorStatusBadge({ large = false, status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.inactive

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-sans font-semibold uppercase tracking-wide',
        large ? 'px-4 py-1 text-[12px]' : 'px-3 py-0.5 text-[11px]',
        config.bg,
        config.text,
        config.border,
      ].join(' ')}
    >
      {config.dotColor ? (
        <span
          className={[
            'inline-block rounded-full',
            large ? 'h-2.5 w-2.5' : 'h-2 w-2',
            config.dotColor,
            config.dotClass,
          ].join(' ')}
        />
      ) : null}
      {config.label}
    </span>
  )
}

export default DoctorStatusBadge
