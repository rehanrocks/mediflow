/* src/features/appointments/components/StatusBadge.jsx - Displays token-based appointment status pills. */
const STATUS_STYLES = {
  scheduled:
    'border-status-scheduled-text/30 bg-status-scheduled-bg text-status-scheduled-text',
  in_progress:
    'border-status-inProgress-text/30 bg-status-inProgress-bg text-status-inProgress-text',
  completed:
    'border-status-completed-text/30 bg-status-completed-bg text-status-completed-text',
  cancelled:
    'border-status-cancelled-text/30 bg-status-cancelled-bg text-status-cancelled-text',
}

function formatStatus(status = '') {
  return status
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function StatusBadge({ status = 'scheduled' }) {
  const normalizedStatus = String(status || 'scheduled').toLowerCase()
  const statusClass = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.scheduled

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 font-mono text-[11px] font-medium uppercase leading-none tracking-wide transition-all duration-200',
        statusClass,
      ].join(' ')}
    >
      {normalizedStatus === 'in_progress' ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-brand" />
      ) : null}
      {formatStatus(normalizedStatus)}
    </span>
  )
}

export default StatusBadge
