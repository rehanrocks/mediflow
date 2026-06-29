import { getPaymentStatus } from '@shared/lib/records'

export function PaymentBadge({ large = false, status }) {
  const normalizedStatus = getPaymentStatus(status)
  const paid = normalizedStatus === 'paid'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border font-sans font-semibold uppercase leading-none tracking-wide',
        large ? 'px-3.5 py-2 text-[12px]' : 'px-2.5 py-1 text-[11px]',
        paid
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-rose-200 bg-rose-50 text-rose-600',
      ].join(' ')}
    >
      {paid ? 'Paid' : 'Unpaid'}
    </span>
  )
}

export function PaymentToggle({
  disabled = false,
  lockPaid = false,
  onChange,
  value,
}) {
  const normalizedStatus = getPaymentStatus(value)

  return (
    <div className="inline-flex rounded-xl border border-hairline bg-mist p-1">
      {[
        {
          label: 'Unpaid',
          value: 'unpaid',
          active: 'border-rose-200 bg-rose-50 text-rose-600',
        },
        {
          label: 'Paid',
          value: 'paid',
          active: 'border-green-200 bg-green-50 text-green-700',
        },
      ].map((option) => {
        const active = normalizedStatus === option.value
        const optionDisabled =
          disabled ||
          (lockPaid && normalizedStatus === 'paid' && option.value === 'unpaid')

        return (
          <button
            className={[
              'rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:cursor-not-allowed disabled:opacity-60',
              active
                ? option.active
                : 'border-transparent text-slate hover:bg-canvas hover:text-ink',
            ].join(' ')}
            disabled={optionDisabled}
            key={option.value}
            onClick={() => onChange(option.value)}
            title={
              optionDisabled && option.value === 'unpaid'
                ? 'Paid appointments cannot be reverted to unpaid'
                : option.label
            }
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default PaymentBadge
