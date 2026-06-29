export const ANALYTICS_PERIODS = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['quarter', 'Quarter'],
  ['year', 'Year'],
]

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
})

const COMPACT_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
})

function cloneDate(value) {
  return new Date(value.getTime())
}

function startOfDay(value) {
  const date = cloneDate(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(value, days) {
  const date = cloneDate(value)
  date.setDate(date.getDate() + days)
  return date
}

function addHours(value, hours) {
  const date = cloneDate(value)
  date.setHours(date.getHours() + hours)
  return date
}

function addMonths(value, months) {
  const date = cloneDate(value)
  date.setMonth(date.getMonth() + months)
  return date
}

function addWeeks(value, weeks) {
  return addDays(value, weeks * 7)
}

function startOfMonth(value) {
  const date = startOfDay(value)
  date.setDate(1)
  return date
}

function createBucket({ end, key, label, start }) {
  return {
    end,
    key,
    label,
    start,
  }
}

export function formatBucketDate(value, options = {}) {
  return new Intl.DateTimeFormat('en-US', options).format(value)
}

export function getAnalyticsBuckets(period = 'week') {
  const today = new Date()

  if (period === 'day') {
    const start = startOfDay(today)
    return Array.from({ length: 12 }, (_, index) => {
      const bucketStart = addHours(start, index * 2)
      const bucketEnd = addHours(bucketStart, 2)

      return createBucket({
        end: bucketEnd,
        key: `hour-${index}`,
        label: formatBucketDate(bucketStart, { hour: 'numeric' }),
        start: bucketStart,
      })
    })
  }

  if (period === 'year') {
    const firstMonth = startOfMonth(addMonths(today, -11))

    return Array.from({ length: 12 }, (_, index) => {
      const bucketStart = addMonths(firstMonth, index)
      const bucketEnd = addMonths(bucketStart, 1)

      return createBucket({
        end: bucketEnd,
        key: bucketStart.toISOString().slice(0, 7),
        label: formatBucketDate(bucketStart, { month: 'short' }),
        start: bucketStart,
      })
    })
  }

  if (period === 'quarter') {
    const firstWeek = startOfDay(addWeeks(today, -12))

    return Array.from({ length: 13 }, (_, index) => {
      const bucketStart = addWeeks(firstWeek, index)
      const bucketEnd = addWeeks(bucketStart, 1)

      return createBucket({
        end: bucketEnd,
        key: bucketStart.toISOString().split('T')[0],
        label: formatBucketDate(bucketStart, { day: 'numeric', month: 'short' }),
        start: bucketStart,
      })
    })
  }

  const length = period === 'month' ? 30 : 7
  const firstDay = startOfDay(addDays(today, -(length - 1)))

  return Array.from({ length }, (_, index) => {
    const bucketStart = addDays(firstDay, index)
    const bucketEnd = addDays(bucketStart, 1)

    return createBucket({
      end: bucketEnd,
      key: bucketStart.toISOString().split('T')[0],
      label:
        period === 'month'
          ? formatBucketDate(bucketStart, { day: 'numeric', month: 'short' })
          : formatBucketDate(bucketStart, { weekday: 'short' }),
      start: bucketStart,
    })
  })
}

export function findBucketForDate(buckets, value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return buckets.find((bucket) => date >= bucket.start && date < bucket.end) || null
}

export function getAxisInterval(period) {
  if (period === 'month') return 3
  if (period === 'quarter') return 1
  return 0
}

export function formatCompactNumber(value) {
  return COMPACT_FORMATTER.format(Number(value || 0))
}

export function formatCurrency(value, { compact = false } = {}) {
  const amount = Number(value || 0)

  if (compact && Math.abs(amount) >= 10000) {
    return `$${formatCompactNumber(amount)}`
  }

  return CURRENCY_FORMATTER.format(amount)
}

export function calculateGrowthPercent(current, previous) {
  const currentValue = Number(current || 0)
  const previousValue = Number(previous || 0)

  if (previousValue <= 0) {
    return currentValue > 0 ? 100 : 0
  }

  return Math.round(((currentValue - previousValue) / previousValue) * 100)
}

export function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))))
}

export function estimateAppointmentRevenue(appointment) {
  const explicitAmount = [
    appointment?.amount,
    appointment?.fee,
    appointment?.consultation_fee,
    appointment?.paid_amount,
    appointment?.total,
    appointment?.total_amount,
    appointment?.payment?.amount,
  ]
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value > 0)

  if (explicitAmount) {
    return explicitAmount
  }

  const status = String(appointment?.status || '').toLowerCase()
  const paymentStatus = String(appointment?.payment_status || '').toLowerCase()

  if (status === 'cancelled') {
    return 0
  }

  const idSeed = Number(appointment?.id || appointment?.pk || 0)
  const narrativeWeight = String(appointment?.reason || appointment?.diagnosis || '').length
  const base = 115 + (idSeed % 5) * 20 + Math.min(45, Math.round(narrativeWeight / 18) * 15)

  if (paymentStatus === 'paid' || status === 'completed') {
    return base
  }

  return Math.round(base * 0.45)
}

export function isCompletedAppointment(appointment) {
  return String(appointment?.status || '').toLowerCase() === 'completed'
}

export function isCancelledAppointment(appointment) {
  return String(appointment?.status || '').toLowerCase() === 'cancelled'
}

export function getPatientIdFromAppointment(appointment) {
  const patient = appointment?.patient
  return patient?.id ?? patient?.pk ?? patient?.uuid ?? patient
}

export function getDoctorIdFromAppointment(appointment) {
  const doctor = appointment?.doctor
  return doctor?.id ?? doctor?.pk ?? doctor?.uuid ?? doctor
}

function escapeCsvCell(value) {
  const text = String(value ?? '')
  if (!/[",\n]/.test(text)) {
    return text
  }

  return `"${text.replace(/"/g, '""')}"`
}

export function downloadCsv(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0 || typeof document === 'undefined') {
    return
  }

  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(href)
}
