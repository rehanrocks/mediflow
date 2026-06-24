import { ServerCrash } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useCountUp } from '@shared/lib/countUp'
import { stagger } from '@shared/lib/motion'

export function DashboardStatCard({
  context,
  icon: Icon,
  index,
  label,
  precision = 0,
  tone,
  value,
}) {
  const count = useCountUp(value, 800, precision)

  return (
    <article
      className="animate-fade-up rounded-card border border-hairline bg-canvas p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(20,24,31,0.08)]"
      style={stagger(index, 0.08)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-slate">{label}</p>
          <p className="mt-3 animate-count-up text-[30px] font-bold leading-none text-ink">
            {count}
          </p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
        </div>
      </div>
      <p className="mt-3 text-[12px] font-semibold text-slate">{context}</p>
    </article>
  )
}

export function DashboardPanel({
  action,
  actionTo,
  bodyClassName = 'p-5',
  children,
  footer,
  headerContent,
  title,
}) {
  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-canvas shadow-card">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {headerContent ? (
          headerContent
        ) : action && actionTo ? (
          <Link
            className="rounded-md px-2 py-1 text-[12px] font-semibold text-brand transition hover:bg-brand-light hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            to={actionTo}
          >
            {action}
          </Link>
        ) : action ? (
          <span className="text-[12px] font-semibold text-slate">{action}</span>
        ) : null}
      </div>
      <div className={bodyClassName}>{children}</div>
      {footer ? <div className="border-t border-hairline px-5 py-3">{footer}</div> : null}
    </section>
  )
}

export function DashboardErrorState({ message, onRetry }) {
  return (
    <section className="rounded-card bg-canvas p-10 text-center shadow-card">
      <ServerCrash aria-hidden="true" className="mx-auto mb-4 h-10 w-10 text-slate/30" />
      <h2 className="text-[16px] font-semibold text-ink">Something went wrong</h2>
      <p className="mt-1 text-[14px] font-normal text-slate">{message}</p>
      <button
        className="mt-5 rounded-control border border-hairline bg-canvas px-4 py-2 text-sm font-semibold text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
        onClick={onRetry}
        type="button"
      >
        Try again
      </button>
    </section>
  )
}

export function DashboardEmptyState({
  className = '',
  description,
  icon: Icon,
  title,
}) {
  return (
    <div
      className={[
        'flex min-h-[180px] flex-col items-center justify-center px-6 py-8 text-center',
        className,
      ].join(' ')}
    >
      {Icon ? <Icon aria-hidden="true" className="mb-3 h-9 w-9 text-brand/25" /> : null}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] font-normal leading-6 text-slate">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export function DashboardChartTooltip({ active, label, payload }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-xl border border-hairline bg-canvas px-3 py-2 shadow-card">
      <p className="text-[13px] font-semibold text-ink">{label}</p>
      {payload.map((item) => (
        <p className="mt-0.5 text-[13px] font-medium text-slate" key={item.dataKey}>
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  )
}
