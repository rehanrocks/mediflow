/* src/features/doctors/components/CaseTypeBreakdown.jsx - Donut chart for case types. */
import { PieChart as PieChartIcon } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import DarkTooltip from '@shared/components/charts/DarkTooltip'

const CASE_TYPE_COLORS = [
  '#4338CA',
  '#6366F1',
  '#818CF8',
  '#A5B4FC',
  '#0D9488',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
]

export function CaseTypeBreakdown({ caseTypesData = [] }) {
  const chartData = Array.isArray(caseTypesData)
    ? caseTypesData.map((item, index) => ({
        count: Number(item.count || 0),
        type: item.type || item.name || `Case Type ${index + 1}`,
      }))
    : []
  const total = chartData.reduce((sum, item) => sum + item.count, 0)

  if (chartData.length === 0 || total === 0) {
    return (
      <section className="flex min-h-[320px] flex-col items-center justify-center rounded-card bg-canvas p-5 text-center shadow-card">
        <PieChartIcon aria-hidden="true" className="mb-2 h-8 w-8 text-brand/20" />
        <p className="text-[14px] font-semibold text-ink">No case type data yet</p>
      </section>
    )
  }

  return (
    <section className="min-w-0 rounded-card bg-canvas p-5 shadow-card">
      <h2 className="text-[16px] font-bold text-ink">Case Types</h2>
      <p className="mt-1 text-[12px] text-slate">
        Distribution of cases by visit reason
      </p>

      <div className="relative mt-2 h-[200px] min-w-0">
        <ResponsiveContainer height="100%" minHeight={1} minWidth={1} width="100%">
          <PieChart>
            <Tooltip content={<DarkTooltip />} />
            <Pie
              data={chartData}
              dataKey="count"
              innerRadius={70}
              label={false}
              labelLine={false}
              outerRadius={90}
              paddingAngle={2}
            >
              {chartData.map((item, index) => (
                <Cell
                  fill={CASE_TYPE_COLORS[index % CASE_TYPE_COLORS.length]}
                  key={item.type}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[20px] font-semibold text-ink">
            {total}
          </span>
          <span className="text-[11px] text-slate">Cases</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {chartData.map((item, index) => {
          const percent = Math.round((item.count / total) * 100)

          return (
            <div className="flex items-center gap-2" key={item.type}>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor:
                    CASE_TYPE_COLORS[index % CASE_TYPE_COLORS.length],
                }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                {item.type}
              </span>
              <span className="font-mono text-[13px] text-slate">
                {item.count}
              </span>
              <span className="w-10 text-right text-[11px] text-slate/60">
                {percent}%
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default CaseTypeBreakdown
