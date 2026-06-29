import { MoreHorizontal, ServerCrash } from 'lucide-react'
import { Link } from 'react-router-dom'

import DarkTooltip from '@shared/components/charts/DarkTooltip'
import {
  emptyStateClass,
  panelHeaderClass,
  surfaceClass,
} from '@shared/components/FormPrimitives'
import { useCountUp } from '@shared/lib/countUp'
import { stagger } from '@shared/lib/motion'

function buildSparklinePoints(values = [], width = 320, height = 92) {
  const safeValues = values.length > 1 ? values : [0, 0, 0, 0]
  const numbers = safeValues.map((value) => Number(value || 0))
  const max = Math.max(...numbers, 1)
  const min = Math.min(...numbers, 0)
  const range = Math.max(max - min, 1)
  const padding = 8
  const step = width / Math.max(numbers.length - 1, 1)
  const linePoints = numbers
    .map((value, index) => {
      const x = index * step
      const y = height - padding - ((value - min) / range) * (height - padding * 2)

      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return {
    areaPoints: `0,${height} ${linePoints} ${width},${height}`,
    linePoints,
  }
}

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
      className={`${surfaceClass} group relative h-full animate-fade-up overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,24,31,0.07)]`}
      style={stagger(index, 0.08)}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="animate-count-up text-[36px] font-extrabold leading-none text-ink">
            {count}
          </p>
          <p className="mt-3 text-[13px] font-medium text-slate">{label}</p>
          <p className="mt-1 text-[12px] font-normal text-slate">{context}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-4">
          <MoreHorizontal aria-hidden="true" className="h-5 w-5 text-slate/35" />
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-control ${tone}`}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
          </div>
        </div>
      </div>
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
    <section className={`${surfaceClass} group/panel relative h-full overflow-hidden`}>
      <div className={panelHeaderClass}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" />
          <h2 className="truncate text-[16px] font-semibold text-ink">
            {title}
          </h2>
        </div>
        {headerContent ? (
          headerContent
        ) : action && actionTo ? (
          <Link
            className="rounded-full border border-brand/10 bg-brand-light px-3 py-1.5 text-[12px] font-semibold text-brand transition hover:-translate-y-0.5 hover:bg-brand hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            to={actionTo}
          >
            {action}
          </Link>
        ) : action ? (
          <span className="rounded-full bg-mist px-3 py-1.5 text-[12px] font-semibold text-slate">
            {action}
          </span>
        ) : null}
      </div>
      <div className={`relative ${bodyClassName}`}>{children}</div>
      {footer ? <div className="border-t border-hairline px-5 py-3">{footer}</div> : null}
    </section>
  )
}

export function DashboardErrorState({ message, onRetry }) {
  return (
    <section className={`${surfaceClass} p-10 text-center`}>
      <ServerCrash aria-hidden="true" className="mx-auto mb-4 h-10 w-10 text-slate/30" />
      <h2 className="text-[18px] font-semibold italic text-slate">Something went wrong</h2>
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
        emptyStateClass,
        className,
      ].join(' ')}
    >
      {Icon ? <Icon aria-hidden="true" className="mb-3 h-9 w-9 text-brand/25" /> : null}
      <p className="text-[18px] font-semibold italic text-slate">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] font-normal leading-6 text-slate">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export function DashboardChartTooltip({ active, label, payload }) {
  return <DarkTooltip active={active} label={label} payload={payload} />
}

export function DashboardMiniSparkline({
  areaClassName = 'fill-white/10',
  className = '',
  lineClassName = 'stroke-white/80',
  values,
}) {
  const { areaPoints, linePoints } = buildSparklinePoints(values)

  return (
    <svg
      aria-hidden="true"
      className={className}
      preserveAspectRatio="none"
      viewBox="0 0 320 92"
    >
      <polygon className={areaClassName} points={areaPoints} />
      <polyline
        className={lineClassName}
        fill="none"
        points={linePoints}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
