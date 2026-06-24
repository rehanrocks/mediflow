/* src/shared/components/doctors/CasesSparkline.jsx - Tiny case trend sparkline. */
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'

function emptySparklineData() {
  return Array.from({ length: 7 }, (_, index) => ({
    date: String(index),
    count: 0,
  }))
}

export function CasesSparkline({ data = [], height = 40 }) {
  const sourceData =
    Array.isArray(data) && data.length > 0 ? data.slice(-7) : emptySparklineData()
  const chartData = sourceData.map((item) => ({
    ...item,
    count: Number(item.count || 0),
  }))
  const maxValue = Math.max(...chartData.map((item) => item.count), 0)
  const hasData = maxValue > 0

  return (
    <div className="min-w-0" style={{ height }}>
      <ResponsiveContainer height="100%" minHeight={1} minWidth={1} width="100%">
      <LineChart
        data={chartData}
        margin={{ bottom: 4, left: 2, right: 2, top: 4 }}
      >
        <YAxis domain={[0, Math.max(maxValue, 1)]} hide />
        <Line
          dataKey="count"
          dot={false}
          isAnimationActive={false}
          stroke={hasData ? '#4338CA' : '#E4E8EB'}
          strokeWidth={1.5}
        type="monotone"
      />
      </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default CasesSparkline
