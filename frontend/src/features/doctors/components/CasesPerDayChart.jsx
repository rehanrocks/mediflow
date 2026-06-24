/* src/features/doctors/components/CasesPerDayChart.jsx - Cases chart for doctor profile. */
import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import DarkTooltip from '@shared/components/charts/DarkTooltip'

function formatDayLabel(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatMonthLabel(value) {
  const [year, month] = String(value || '').split('-')

  if (!year || !month) {
    return value
  }

  const date = new Date(Number(year), Number(month) - 1, 1)

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
  }).format(date)
}

export function CasesPerDayChart({
  avgCasesPerDay = 0,
  dailyCasesData = [],
  monthlySummaryData = [],
}) {
  const [view, setView] = useState('30d')
  const [isFading, setIsFading] = useState(false)

  const processedData = useMemo(() => {
    const average = Number(avgCasesPerDay || 0)

    if (view === '12m') {
      const source = Array.isArray(monthlySummaryData) ? monthlySummaryData : []
      return source.slice(-12).map((item) => ({
        avg: average,
        count: Number(item.count || 0),
        date: item.month,
        label: formatMonthLabel(item.month),
      }))
    }

    const source = Array.isArray(dailyCasesData) ? dailyCasesData : []
    return source.slice(-30).map((item) => ({
      avg: average,
      count: Number(item.count || 0),
      date: item.date,
      label: formatDayLabel(item.date),
    }))
  }, [avgCasesPerDay, dailyCasesData, monthlySummaryData, view])

  function handleViewChange(nextView) {
    if (nextView === view) return

    setIsFading(true)
    window.setTimeout(() => {
      setView(nextView)
      setIsFading(false)
    }, 120)
  }

  return (
    <section className="min-w-0 rounded-card bg-canvas p-6 shadow-card">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[16px] font-bold text-ink">Cases Per Day</h2>
        <div className="inline-flex w-fit rounded-full bg-mist p-1">
          {[
            ['30d', '30 Days'],
            ['12m', '12 Months'],
          ].map(([value, label]) => (
            <button
              className={[
                'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all',
                view === value
                  ? 'bg-canvas text-brand shadow-sm'
                  : 'text-slate hover:text-ink',
              ].join(' ')}
              key={value}
              onClick={() => handleViewChange(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={[
          'h-[260px] transition-opacity duration-200',
          isFading ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
      >
        {processedData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[14px] font-medium text-slate">
            No case data available for this period
          </div>
        ) : (
          <ResponsiveContainer height="100%" minHeight={1} minWidth={1} width="100%">
            <ComposedChart
              data={processedData}
              margin={{ bottom: 10, left: 0, right: 10, top: 10 }}
            >
              <CartesianGrid
                stroke="#E4E8EB"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                interval={view === '30d' ? 4 : 0}
                tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#5B6472', fontSize: 10 }}
                tickLine={false}
              />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: '#EEF2FF55' }} />
              <ReferenceLine
                y={Number(avgCasesPerDay || 0)}
                stroke="#F59E0B"
                strokeDasharray="6 3"
                label={{
                  value: `Avg ${Number(avgCasesPerDay || 0)}`,
                  fill: '#F59E0B',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                }}
              />
              <Bar dataKey="count" fill="#EEF2FF" name="Daily Cases" radius={[4, 4, 0, 0]} />
              <Line
                dataKey="avg"
                dot={false}
                name="Career Average"
                stroke="#F59E0B"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-slate">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-light" />
          Daily Cases
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-px w-5 border-t border-dashed border-amber-500" />
          Career Average
        </span>
      </div>
    </section>
  )
}

export default CasesPerDayChart
