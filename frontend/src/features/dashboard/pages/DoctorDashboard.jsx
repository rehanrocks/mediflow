import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Clock3,
  Eye,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link, useNavigate } from 'react-router-dom'

import PaymentBadge from '@features/appointments/components/PaymentBadge'
import StatusBadge from '@features/appointments/components/StatusBadge'
import {
  DashboardChartTooltip,
  DashboardEmptyState,
  DashboardErrorState,
  DashboardMiniSparkline,
  DashboardPanel,
  DashboardStatCard,
} from '@features/dashboard/components/DashboardPrimitives'
import Avatar from '@shared/components/Avatar'
import SkeletonRow from '@shared/components/SkeletonRow'
import { useAuth } from '@shared/context/AuthContext'
import { buildGreeting } from '@shared/lib/greeting'
import { stagger } from '@shared/lib/motion'
import { getUserDoctorId, usePermission } from '@shared/lib/usePermission'
import {
  formatDate,
  formatDateParts,
  getAppointmentDate,
  getAppointmentPatientName,
  getBackendError,
  getPatientAge,
  getPatientConditions,
  getPatientName,
  normalizeList,
} from '@shared/lib/records'
import {
  getAppointments,
  getDoctorById,
  getDoctorStats,
  getPatients,
} from '@shared/services/api'

const CARD_GRID_CLASSES = {
  1: 'grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 xl:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
}

const EMPTY_DOCTOR_STATS = {
  avg_cases_per_day: 0,
  cases_this_week: 0,
  cases_today: 0,
  case_types: [],
  daily_cases: [],
  monthly_summary: [],
}

const STATUS_COLORS = {
  scheduled: '#0EA5E9',
  in_progress: '#D97706',
  completed: '#059669',
  cancelled: '#DC2626',
}

const SCHEDULE_TIME_BUCKETS = [
  { end: 9, key: 'early', label: '7-9a', start: 7 },
  { end: 11, key: 'morning', label: '9-11a', start: 9 },
  { end: 13, key: 'midday', label: '11-1p', start: 11 },
  { end: 15, key: 'afternoon', label: '1-3p', start: 13 },
  { end: 18, key: 'late', label: '3-6p', start: 15 },
]

function formatStatusLabel(status) {
  return String(status || 'scheduled')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getCount(response) {
  if (Number.isFinite(Number(response?.count))) {
    return Number(response.count)
  }

  return normalizeList(response).length
}

function getDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().split('T')[0]
}

function isSameDay(value, reference = new Date()) {
  return Boolean(value) && getDateKey(value) === getDateKey(reference)
}

function formatClock(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  const [hours, minutes] = String(value).split(':')

  if (!hours || !minutes) {
    return String(value)
  }

  const parsed = new Date()
  parsed.setHours(Number(hours), Number(minutes), 0, 0)

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

function formatLongDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(value)
}

function formatDayLabel(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
  }).format(date)
}

function parseNextParams(nextUrl) {
  if (!nextUrl) {
    return null
  }

  try {
    const url = new URL(nextUrl, 'http://mediflow.local')
    return Object.fromEntries(url.searchParams.entries())
  } catch {
    return null
  }
}

function normalizePaginatedResponse(response) {
  const results = normalizeList(response)

  return {
    count: Number.isFinite(Number(response?.count)) ? Number(response.count) : results.length,
    next: response?.next || null,
    results,
  }
}

export function DoctorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canRead, role } = usePermission()
  const appointmentsEnabled = canRead('appointments')
  const patientsEnabled = canRead('patients')
  const doctorId = getUserDoctorId(user)
  const doctorUser = role?.slug === 'doctor'
  const supportPreview = !doctorUser
  const [dashboardData, setDashboardData] = useState({
    doctorProfile: null,
    patients: [],
    recentActivity: [],
    recentCount: 0,
    recentNextPage: null,
    stats: EMPTY_DOCTOR_STATS,
    todayAppointments: [],
    totalPatients: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')

  const loadDashboardData = useCallback(async (isMounted = () => true) => {
    if (supportPreview) {
      setDashboardData({
        doctorProfile: null,
        patients: [],
        recentActivity: [],
        recentCount: 0,
        recentNextPage: null,
        stats: EMPTY_DOCTOR_STATS,
        todayAppointments: [],
        totalPatients: 0,
      })
      setLoadError('')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError('')

    try {
      const statsPromise = appointmentsEnabled && doctorId
        ? getDoctorStats(doctorId).catch((error) => {
            if (error?.response?.status === 404) {
              return EMPTY_DOCTOR_STATS
            }

            throw error
          })
        : Promise.resolve(EMPTY_DOCTOR_STATS)

      const doctorPromise = doctorId
        ? getDoctorById(doctorId).catch((error) => {
            if (error?.response?.status === 404) {
              return null
            }

            throw error
          })
        : Promise.resolve(null)

      const [
        todayAppointmentsResponse,
        patientsResponse,
        statsResponse,
        doctorResponse,
        recentActivityResponse,
      ] = await Promise.all([
        appointmentsEnabled
          ? getAppointments({ ordering: 'appointment_dt', period: 'day' })
          : Promise.resolve([]),
        patientsEnabled ? getPatients() : Promise.resolve([]),
        statsPromise,
        doctorPromise,
        appointmentsEnabled
          ? getAppointments({ limit: 10, offset: 0, ordering: '-appointment_dt', status: 'completed' })
          : Promise.resolve({ count: 0, next: null, results: [] }),
      ])

      if (!isMounted()) {
        return
      }

      const normalizedRecent = normalizePaginatedResponse(recentActivityResponse)

      setDashboardData({
        doctorProfile: doctorResponse,
        patients: normalizeList(patientsResponse),
        recentActivity: normalizedRecent.results,
        recentCount: normalizedRecent.count,
        recentNextPage: normalizedRecent.next,
        stats: {
          ...EMPTY_DOCTOR_STATS,
          ...statsResponse,
          avg_cases_per_day: Number(statsResponse?.avg_cases_per_day || 0),
          cases_this_week: Number(statsResponse?.cases_this_week || 0),
          cases_today: Number(statsResponse?.cases_today || 0),
          daily_cases: Array.isArray(statsResponse?.daily_cases)
            ? statsResponse.daily_cases
            : [],
        },
        todayAppointments: normalizeList(todayAppointmentsResponse)
          .filter((appointment) => isSameDay(appointment.appointment_dt))
          .sort((first, second) => getAppointmentDate(first) - getAppointmentDate(second)),
        totalPatients: getCount(patientsResponse),
      })
    } catch (error) {
      if (!isMounted()) {
        return
      }

      setLoadError(getBackendError(error, 'Doctor dashboard could not be loaded.'))
    } finally {
      if (isMounted()) {
        setIsLoading(false)
      }
    }
  }, [appointmentsEnabled, doctorId, patientsEnabled, supportPreview])

  useEffect(() => {
    let mounted = true

    queueMicrotask(() => {
      loadDashboardData(() => mounted)
    })

    return () => {
      mounted = false
    }
  }, [loadDashboardData])

  const scheduleAppointments = useMemo(
    () =>
      [...dashboardData.todayAppointments].sort(
        (first, second) => getAppointmentDate(first) - getAppointmentDate(second),
      ),
    [dashboardData.todayAppointments],
  )

  const nextAppointment = scheduleAppointments[0] || null

  const myPatients = useMemo(
    () =>
      [...dashboardData.patients]
        .sort((first, second) => {
          const nextFirst = getAppointmentDate(first.next_appointment_date)
          const nextSecond = getAppointmentDate(second.next_appointment_date)

          if (nextFirst && nextSecond) {
            return nextFirst - nextSecond
          }

          if (nextFirst) {
            return -1
          }

          if (nextSecond) {
            return 1
          }

          return getPatientName(first).localeCompare(getPatientName(second))
        })
        .slice(0, 6),
    [dashboardData.patients],
  )

  const averageCases = Number(dashboardData.stats.avg_cases_per_day || 0)

  const casesChartData = useMemo(
    () =>
      (dashboardData.stats.daily_cases || []).slice(-7).map((item) => ({
        avg: averageCases,
        count: Number(item.count || 0),
        day: formatDayLabel(item.date),
        fullDate: formatDate(item.date),
      })),
    [averageCases, dashboardData.stats.daily_cases],
  )

  const doctorHeroSparkline = useMemo(
    () => casesChartData.map((day) => day.count),
    [casesChartData],
  )

  const doctorHeroSparkLabels = useMemo(() => {
    if (casesChartData.length === 0) {
      return ['Start', 'Mid', 'Now']
    }

    return [
      casesChartData[0]?.day || 'Start',
      casesChartData[Math.floor(casesChartData.length / 2)]?.day || 'Mid',
      casesChartData.at(-1)?.day || 'Now',
    ]
  }, [casesChartData])

  const weeklyCasesTotal = useMemo(
    () => casesChartData.reduce((sum, day) => sum + day.count, 0),
    [casesChartData],
  )

  const bestCaseDay = useMemo(
    () =>
      casesChartData.reduce(
        (best, day) => (day.count > (best?.count || 0) ? day : best),
        null,
      ),
    [casesChartData],
  )

  const hourlyScheduleData = useMemo(() => {
    const buckets = SCHEDULE_TIME_BUCKETS.map((bucket) => ({
      ...bucket,
      cancelled: 0,
      completed: 0,
      count: 0,
      inProgress: 0,
      scheduled: 0,
    }))

    dashboardData.todayAppointments.forEach((appointment) => {
      const appointmentDate = getAppointmentDate(appointment)

      if (!appointmentDate) {
        return
      }

      const hour = appointmentDate.getHours()
      const targetBucket =
        buckets.find((bucket) => hour >= bucket.start && hour < bucket.end) ||
        (hour < buckets[0].start ? buckets[0] : buckets.at(-1))
      const status = String(appointment.status || 'scheduled').toLowerCase()

      targetBucket.count += 1

      if (status === 'completed') {
        targetBucket.completed += 1
      } else if (status === 'cancelled') {
        targetBucket.cancelled += 1
      } else if (status === 'in_progress') {
        targetBucket.inProgress += 1
      } else {
        targetBucket.scheduled += 1
      }
    })

    return buckets
  }, [dashboardData.todayAppointments])

  const hourlyScheduleTotal = useMemo(
    () => hourlyScheduleData.reduce((sum, item) => sum + item.count, 0),
    [hourlyScheduleData],
  )

  const busiestScheduleSlot = useMemo(
    () =>
      hourlyScheduleData.reduce(
        (best, item) => (item.count > (best?.count || 0) ? item : best),
        null,
      ),
    [hourlyScheduleData],
  )

  const todayStatusData = useMemo(() => {
    const statusCounts = dashboardData.todayAppointments.reduce((counts, appointment) => {
      const status = String(appointment.status || 'scheduled').toLowerCase()
      counts[status] = (counts[status] || 0) + 1
      return counts
    }, {})

    return ['scheduled', 'in_progress', 'completed', 'cancelled']
      .map((status) => ({
        color: STATUS_COLORS[status],
        count: statusCounts[status] || 0,
        label: formatStatusLabel(status),
        status,
      }))
      .filter((item) => item.count > 0)
  }, [dashboardData.todayAppointments])

  const todayCompletedCount = useMemo(
    () =>
      dashboardData.todayAppointments.filter(
        (appointment) => String(appointment.status || '').toLowerCase() === 'completed',
      ).length,
    [dashboardData.todayAppointments],
  )

  const todayOpenCount = useMemo(
    () =>
      dashboardData.todayAppointments.filter((appointment) => {
        const status = String(appointment.status || '').toLowerCase()
        return status !== 'completed' && status !== 'cancelled'
      }).length,
    [dashboardData.todayAppointments],
  )

  const scheduleCompletionRate = dashboardData.todayAppointments.length
    ? Math.round((todayCompletedCount / dashboardData.todayAppointments.length) * 100)
    : 0

  const patientConditionData = useMemo(() => {
    const conditionCounts = dashboardData.patients.reduce((counts, patient) => {
      const condition = getPatientConditions(patient)[0] || 'Unspecified'
      counts[condition] = (counts[condition] || 0) + 1
      return counts
    }, {})

    return Object.entries(conditionCounts)
      .map(([label, count]) => ({ count, label }))
      .sort((first, second) => second.count - first.count)
      .slice(0, 5)
  }, [dashboardData.patients])

  const topCondition = patientConditionData[0]?.label || 'No condition mix'

  const todayStatusTotal = useMemo(
    () => todayStatusData.reduce((sum, item) => sum + item.count, 0),
    [todayStatusData],
  )

  const todayStatusPeak = useMemo(
    () => Math.max(1, ...todayStatusData.map((item) => item.count)),
    [todayStatusData],
  )

  const conditionTotal = useMemo(
    () => patientConditionData.reduce((sum, item) => sum + item.count, 0),
    [patientConditionData],
  )

  const conditionPeak = useMemo(
    () => Math.max(1, ...patientConditionData.map((item) => item.count)),
    [patientConditionData],
  )

  const statCards = useMemo(
    () =>
      [
        appointmentsEnabled
          ? {
              context: 'Today',
              icon: ClipboardList,
              label: 'Cases Today',
              tone: 'bg-[#FCE7F3] text-[#DB2777]',
              value: dashboardData.stats.cases_today,
            }
          : null,
        appointmentsEnabled
          ? {
              context: 'This week',
              icon: CalendarDays,
              label: 'This Week',
              tone: 'bg-[#F3E8FF] text-[#7C3AED]',
              value: dashboardData.stats.cases_this_week,
            }
          : null,
        patientsEnabled
          ? {
              context: 'Assigned records',
              icon: Users,
              label: 'My Patients',
              tone: 'bg-[#E0F2FE] text-[#0284C7]',
              value: dashboardData.totalPatients,
            }
          : null,
        appointmentsEnabled
          ? {
              context: 'Per working day',
              icon: TrendingUp,
              label: 'Daily Average',
              precision: 1,
              tone: 'bg-[#ECFDF5] text-[#059669]',
              value: dashboardData.stats.avg_cases_per_day,
            }
          : null,
      ].filter(Boolean),
    [
      appointmentsEnabled,
      dashboardData.stats.avg_cases_per_day,
      dashboardData.stats.cases_this_week,
      dashboardData.stats.cases_today,
      dashboardData.totalPatients,
      patientsEnabled,
    ],
  )

  const doctorSignals = useMemo(
    () => [
      {
        context: `${todayOpenCount} still open`,
        icon: CalendarCheck,
        label: 'Schedule',
        tone: 'bg-[#E0F2FE] text-[#0284C7]',
        value: `${scheduleCompletionRate}% done`,
      },
      {
        context: 'Top patient cluster',
        icon: HeartPulse,
        label: 'Condition Focus',
        tone: 'bg-[#FCE7F3] text-[#DB2777]',
        value: topCondition,
      },
      {
        context: `${averageCases.toFixed(1)} daily average`,
        icon: ShieldCheck,
        label: 'Case Rhythm',
        tone: 'bg-[#ECFDF5] text-[#059669]',
        value: `${dashboardData.stats.cases_this_week} this week`,
      },
    ],
    [
      averageCases,
      dashboardData.stats.cases_this_week,
      scheduleCompletionRate,
      todayOpenCount,
      topCondition,
    ],
  )

  const supportHeroTitle = 'Doctor workspace preview'
  const supportHeroDescription =
    'Use a doctor account to view personal schedule, patient activity, and performance metrics.'
  const heroGreeting = doctorUser ? buildGreeting(user, role) : supportHeroTitle
  const heroDateLine = doctorUser ? formatLongDate() : supportHeroDescription
  const arrivalValue =
    doctorUser && dashboardData.doctorProfile?.today_checkin
      ? formatClock(dashboardData.doctorProfile.today_checkin)
      : '-'
  const shiftValue =
    doctorUser && dashboardData.doctorProfile
      ? `${formatClock(dashboardData.doctorProfile.shift_start)} - ${formatClock(dashboardData.doctorProfile.shift_end)}`
      : 'Support preview'

  async function handleLoadMoreRecentActivity() {
    const nextParams = parseNextParams(dashboardData.recentNextPage)

    if (!nextParams || supportPreview) {
      return
    }

    setIsLoadingMore(true)

    try {
      const response = await getAppointments({
        ordering: '-appointment_dt',
        status: 'completed',
        ...nextParams,
      })
      const normalized = normalizePaginatedResponse(response)

      setDashboardData((currentData) => ({
        ...currentData,
        recentActivity: [...currentData.recentActivity, ...normalized.results],
        recentCount: normalized.count,
        recentNextPage: normalized.next,
      }))
    } catch (error) {
      setLoadError(getBackendError(error, 'More appointments could not be loaded.'))
    } finally {
      setIsLoadingMore(false)
    }
  }

  if (loadError) {
    return <DashboardErrorState message={loadError} onRetry={() => loadDashboardData()} />
  }

  return (
    <div className="dashboard-stage space-y-5">
      <section className="relative animate-fade-up overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FAFC_54%,#E0F2FE_100%)] p-6 shadow-[0_24px_80px_rgba(20,24,31,0.09)]">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#0EA5E9]/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-[#7C3AED]/15 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-white/75 px-3 py-1.5 text-[12px] font-semibold text-sky-700 shadow-sm backdrop-blur">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                Clinical cockpit
              </span>
              <h2 className="mt-4 max-w-2xl text-[28px] font-bold leading-tight tracking-[-0.03em] text-ink md:text-[34px]">
                {heroGreeting}
              </h2>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate">
                {heroDateLine}
              </p>
              <p className="mt-4 inline-flex items-center rounded-full bg-white/80 px-3 py-1.5 font-mono text-[12px] font-semibold text-slate shadow-sm">
                <Clock3 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 text-brand" />
                Shift {shiftValue}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {doctorSignals.map((signal, index) => {
                const SignalIcon = signal.icon

                return (
                  <div
                    className="animate-fade-up rounded-[20px] border border-white/75 bg-white/80 p-4 shadow-[0_12px_34px_rgba(20,24,31,0.06)] backdrop-blur"
                    key={signal.label}
                    style={stagger(index, 0.05)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
                          {signal.label}
                        </p>
                        <p className="mt-2 truncate text-[18px] font-bold leading-none text-ink">
                          {isLoading ? '-' : signal.value}
                        </p>
                        <p className="mt-2 truncate text-[12px] font-medium text-slate">
                          {isLoading ? 'Syncing schedule' : signal.context}
                        </p>
                      </div>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${signal.tone}`}>
                        <SignalIcon aria-hidden="true" className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(160deg,#0F172A_0%,#4338CA_55%,#7C3AED_100%)] p-5 text-white shadow-[0_22px_60px_rgba(67,56,202,0.28)]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-white/70">Today&apos;s work</p>
                <p className="mt-3 text-[46px] font-bold leading-none tracking-[-0.04em]">
                  {isLoading ? '--' : Number(dashboardData.stats.cases_today || 0)}
                </p>
                <p className="mt-2 text-[13px] text-white/70">cases today</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur">
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                Arrived {arrivalValue}
              </span>
            </div>

            <div className="relative mt-8 h-[92px]">
              <DashboardMiniSparkline
                areaClassName="fill-white/10"
                className="analytics-wave absolute inset-0 h-full w-full overflow-visible"
                lineClassName="stroke-white/85"
                values={doctorHeroSparkline}
              />
              <div className="absolute bottom-0 left-0 right-0 flex justify-between font-mono text-[11px] text-white/60">
                {doctorHeroSparkLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
                  Next patient
                </p>
                <p className="mt-1 truncate text-[16px] font-bold">
                  {nextAppointment ? getAppointmentPatientName(nextAppointment) : 'Schedule clear'}
                </p>
                <p className="mt-1 font-mono text-[11px] text-white/60">
                  {nextAppointment ? formatClock(nextAppointment.appointment_dt) : '-'}
                </p>
              </div>
              <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
                  Completion
                </p>
                <p className="mt-1 text-[22px] font-bold">{isLoading ? '-' : `${scheduleCompletionRate}%`}</p>
                <p className="mt-1 text-[11px] text-white/60">{todayCompletedCount} finished</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {statCards.length > 0 ? (
        <section
          className={['grid gap-4', CARD_GRID_CLASSES[statCards.length] || CARD_GRID_CLASSES[4]].join(' ')}
        >
          {isLoading
            ? statCards.map((card, index) => (
                <SkeletonRow index={index} key={card.label} variant="stat" />
              ))
            : statCards.map((card, index) => (
                <DashboardStatCard
                  context={card.context}
                  icon={card.icon}
                  index={index}
                  key={card.label}
                  label={card.label}
                  precision={card.precision}
                  tone={card.tone}
                  value={card.value}
                />
              ))}
        </section>
      ) : null}

      {appointmentsEnabled || patientsEnabled ? (
        <section className="grid gap-5 xl:grid-cols-3">
          {appointmentsEnabled ? (
            <DashboardPanel bodyClassName="p-0" title="Today's Status Mix">
              {isLoading ? (
                <div className="m-5 h-[300px] rounded-[24px] bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : todayStatusData.length === 0 ? (
                <DashboardEmptyState title="No schedule status data yet" />
              ) : (
                <div className="analytics-surface overflow-hidden p-5">
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate">
                        Today&apos;s schedule pulse
                      </p>
                      <p className="mt-2 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink">
                        {todayStatusTotal}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-slate">
                        appointments on your board
                      </p>
                    </div>
                    <span className="rounded-full bg-[#ECFDF5] px-3 py-1.5 font-mono text-[11px] font-bold text-[#059669]">
                      {scheduleCompletionRate}% done
                    </span>
                  </div>

                  <div className="relative mt-5 h-[224px]">
                    <ResponsiveContainer height="100%" width="100%">
                      <BarChart data={todayStatusData} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                        <defs>
                          <linearGradient id="doctorStatusGradient-scheduled" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#38BDF8" />
                            <stop offset="100%" stopColor="#0284C7" />
                          </linearGradient>
                          <linearGradient id="doctorStatusGradient-in_progress" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#F59E0B" />
                            <stop offset="100%" stopColor="#D97706" />
                          </linearGradient>
                          <linearGradient id="doctorStatusGradient-completed" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#34D399" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                          <linearGradient id="doctorStatusGradient-cancelled" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#FB7185" />
                            <stop offset="100%" stopColor="#DC2626" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 7" vertical={false} />
                        <XAxis
                          axisLine={false}
                          dataKey="label"
                          tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                          tickLine={false}
                          tickMargin={12}
                        />
                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                          tickLine={false}
                          tickMargin={8}
                        />
                        <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#FFFFFF66' }} />
                        <Bar
                          background={{ fill: '#EEF2F7', radius: 10 }}
                          barSize={58}
                          dataKey="count"
                          name="Appointments"
                          radius={[14, 14, 8, 8]}
                        >
                          {todayStatusData.map((item) => (
                            <Cell fill={`url(#doctorStatusGradient-${item.status})`} key={item.status} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="relative mt-4 grid gap-2 sm:grid-cols-3">
                    {todayStatusData.map((item) => (
                      <div className="rounded-2xl bg-white/80 p-3 shadow-sm" key={item.status}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] font-semibold text-slate">
                            {item.label}
                          </span>
                          <span className="font-mono text-[12px] font-bold text-ink">{item.count}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: item.color,
                              width: `${Math.round((item.count / todayStatusPeak) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DashboardPanel>
          ) : null}

          {appointmentsEnabled ? (
            <DashboardPanel bodyClassName="p-0" title="Today's Hourly Flow">
              {isLoading ? (
                <div className="m-5 h-[300px] rounded-[24px] bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : hourlyScheduleTotal === 0 ? (
                <DashboardEmptyState title="No hourly schedule data yet" />
              ) : (
                <div className="analytics-surface overflow-hidden p-5">
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate">
                        Bar graph by time
                      </p>
                      <p className="mt-2 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink">
                        {hourlyScheduleTotal}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-slate">
                        appointments across the day
                      </p>
                    </div>
                    <span className="rounded-full bg-[#E0F2FE] px-3 py-1.5 font-mono text-[11px] font-bold text-[#0284C7]">
                      Peak {busiestScheduleSlot?.label || '-'}
                    </span>
                  </div>

                  <div className="relative mt-5 h-[224px]">
                    <ResponsiveContainer height="100%" width="100%">
                      <BarChart data={hourlyScheduleData} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                        <defs>
                          <linearGradient id="hourlyFlowScheduled" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#38BDF8" />
                            <stop offset="100%" stopColor="#0284C7" />
                          </linearGradient>
                          <linearGradient id="hourlyFlowCompleted" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#34D399" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                          <linearGradient id="hourlyFlowInProgress" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#FBBF24" />
                            <stop offset="100%" stopColor="#D97706" />
                          </linearGradient>
                          <linearGradient id="hourlyFlowCancelled" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#FB7185" />
                            <stop offset="100%" stopColor="#DC2626" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 7" vertical={false} />
                        <XAxis
                          axisLine={false}
                          dataKey="label"
                          tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                          tickLine={false}
                          tickMargin={12}
                        />
                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                          tickLine={false}
                          tickMargin={8}
                        />
                        <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#FFFFFF66' }} />
                        <Bar
                          barSize={38}
                          dataKey="scheduled"
                          fill="url(#hourlyFlowScheduled)"
                          name="Scheduled"
                          radius={[10, 10, 6, 6]}
                          stackId="hourly"
                        />
                        <Bar
                          barSize={38}
                          dataKey="inProgress"
                          fill="url(#hourlyFlowInProgress)"
                          name="In Progress"
                          radius={[10, 10, 6, 6]}
                          stackId="hourly"
                        />
                        <Bar
                          barSize={38}
                          dataKey="completed"
                          fill="url(#hourlyFlowCompleted)"
                          name="Completed"
                          radius={[10, 10, 6, 6]}
                          stackId="hourly"
                        />
                        <Bar
                          barSize={38}
                          dataKey="cancelled"
                          fill="url(#hourlyFlowCancelled)"
                          name="Cancelled"
                          radius={[10, 10, 6, 6]}
                          stackId="hourly"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="relative mt-4 grid grid-cols-5 gap-2">
                    {hourlyScheduleData.map((bucket) => (
                      <div className="rounded-2xl bg-white/80 p-2.5 text-center shadow-sm" key={bucket.key}>
                        <p className="font-mono text-[11px] font-bold text-ink">{bucket.count}</p>
                        <p className="mt-1 text-[10px] font-semibold text-slate">{bucket.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DashboardPanel>
          ) : null}

          {patientsEnabled ? (
            <DashboardPanel bodyClassName="p-0" title="My Patient Conditions">
              {isLoading ? (
                <div className="m-5 h-[300px] rounded-[24px] bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : patientConditionData.length === 0 ? (
                <DashboardEmptyState title="No condition data yet" />
              ) : (
                <div className="analytics-surface overflow-hidden p-5">
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate">
                        Clinical condition mix
                      </p>
                      <p className="mt-2 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink">
                        {conditionTotal}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-slate">
                        assigned patient conditions
                      </p>
                    </div>
                    <span className="max-w-[150px] truncate rounded-full bg-brand-light px-3 py-1.5 text-[11px] font-bold text-brand">
                      Focus {topCondition}
                    </span>
                  </div>

                  <div className="relative mt-6 space-y-4">
                    {patientConditionData.map((condition, index) => {
                      const palette = ['#4338CA', '#0EA5E9', '#0D9488', '#F59E0B', '#DB2777']
                      const color = palette[index % palette.length]
                      const percent = Math.round((condition.count / conditionTotal) * 100)

                      return (
                        <div
                          className="animate-fade-up rounded-[20px] border border-white/80 bg-white/80 p-4 shadow-[0_10px_30px_rgba(20,24,31,0.05)]"
                          key={condition.label}
                          style={stagger(index, 0.04)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-bold text-ink">
                                {condition.label}
                              </p>
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate">
                                Rank {index + 1}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-[18px] font-bold text-ink">
                                {condition.count}
                              </p>
                              <p className="font-mono text-[11px] font-semibold text-slate">
                                {percent}%
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r"
                              style={{
                                backgroundImage: `linear-gradient(90deg, ${color}, ${color}99)`,
                                width: `${Math.max(8, Math.round((condition.count / conditionPeak) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </DashboardPanel>
          ) : null}
        </section>
      ) : null}

      {appointmentsEnabled ? (
        <DashboardPanel
          bodyClassName="p-0"
          headerContent={
            <span className="font-mono text-[13px] font-medium text-slate">
              {formatLongDate()}
            </span>
          }
          title="Today's Schedule"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead className="border-b border-hairline bg-mist">
                <tr>
                  {['Patient', 'Appointment Time', 'Reason', 'Status', 'Details'].map((header) => (
                    <th
                      className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate"
                      key={header}
                      scope="col"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonRow columns={5} index={index} key={index} />
                  ))
                ) : scheduleAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <DashboardEmptyState
                        description="Your schedule is clear"
                        icon={CalendarCheck}
                        title="No appointments scheduled for today"
                      />
                    </td>
                  </tr>
                ) : (
                  scheduleAppointments.map((appointment, index) => (
                    <tr
                      className="animate-fade-up border-b border-hairline last:border-0 hover:bg-brand-light/30"
                      key={appointment.id}
                      style={stagger(index, 0.04)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={getAppointmentPatientName(appointment)} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium text-ink">
                              {getAppointmentPatientName(appointment)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-[13px] font-medium text-ink">
                        {formatClock(appointment.appointment_dt)}
                      </td>
                      <td
                        className="max-w-[220px] truncate px-5 py-4 text-[13px] text-slate"
                        title={appointment.reason || 'No reason provided'}
                      >
                        {appointment.reason || '-'}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={appointment.status} />
                      </td>
                      <td className="px-5 py-4">
                        <button
                          className="rounded-lg border border-blue-200 bg-blue-50 p-1.5 text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                          onClick={() => navigate(`/appointments/${appointment.id}`)}
                          title="View appointment"
                          type="button"
                        >
                          <span className="sr-only">View appointment</span>
                          <Eye aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
        {patientsEnabled ? (
          <DashboardPanel
            action="View all"
            actionTo="/patients"
            bodyClassName="p-0"
            headerContent={
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-brand-light px-2 py-0.5 font-mono text-[11px] font-semibold text-brand">
                  {dashboardData.totalPatients}
                </span>
                <Link
                  className="rounded-md px-2 py-1 text-[12px] font-semibold text-brand transition hover:bg-brand-light hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                  to="/patients"
                >
                  View all
                </Link>
              </div>
            }
            title="My Patients"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="border-b border-hairline bg-mist">
                  <tr>
                    {['Patient', 'Age', 'Condition', 'Last Visit', 'Next Appointment'].map((header) => (
                      <th
                        className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate"
                        key={header}
                        scope="col"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <SkeletonRow columns={5} index={index} key={index} />
                    ))
                  ) : myPatients.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <DashboardEmptyState title="No patients assigned yet" />
                      </td>
                    </tr>
                  ) : (
                    myPatients.map((patient, index) => (
                      <tr
                        className="animate-fade-up cursor-pointer border-b border-hairline last:border-0 hover:bg-brand-light/30"
                        key={patient.id}
                        onClick={() => navigate(`/patients/${patient.id}`)}
                        style={stagger(index, 0.04)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={getPatientName(patient)} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-medium text-ink">
                                {getPatientName(patient)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-[13px] text-ink">
                          {Number.isFinite(getPatientAge(patient)) ? getPatientAge(patient) : '-'}
                        </td>
                        <td className="px-5 py-4 text-[13px] text-slate">
                          {getPatientConditions(patient)[0] || '-'}
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-slate">
                          {formatDate(patient.last_visit_date)}
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-slate">
                          {formatDate(patient.next_appointment_date)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardPanel>
        ) : null}

        {appointmentsEnabled ? (
          <DashboardPanel bodyClassName="p-0" title="My Cases - Last 7 Days">
            {isLoading ? (
              <div className="m-5 h-[260px] rounded-[24px] bg-mist p-4">
                <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
              </div>
            ) : casesChartData.length < 2 ? (
              <DashboardEmptyState title="Not enough data yet" />
            ) : (
              <div className="analytics-surface overflow-hidden p-5">
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate">
                      Case momentum
                    </p>
                    <p className="mt-2 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink">
                      {weeklyCasesTotal}
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-slate">
                      completed cases this week
                    </p>
                  </div>
                  <span className="rounded-full bg-[#FFF7ED] px-3 py-1.5 font-mono text-[11px] font-bold text-[#C2410C]">
                    Peak {bestCaseDay?.day || '-'}
                  </span>
                </div>

                <div className="relative mt-5 h-[220px]">
                  <ResponsiveContainer height="100%" width="100%">
                    <ComposedChart data={casesChartData} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="doctorCasesBarGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#7C3AED" />
                          <stop offset="100%" stopColor="#4338CA" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 7" vertical={false} />
                      <XAxis
                        axisLine={false}
                        dataKey="day"
                        tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                        tickLine={false}
                        tickMargin={12}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                        tickLine={false}
                        tickMargin={8}
                      />
                      <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#EEF2FF55' }} />
                      <ReferenceLine
                        y={averageCases}
                        stroke="#F59E0B"
                        strokeDasharray="6 3"
                        label={{
                          value: `Avg ${averageCases}`,
                          fill: '#F59E0B',
                          fontSize: 10,
                          fontFamily: 'JetBrains Mono',
                        }}
                      />
                      <Bar
                        background={{ fill: '#EEF2F7', radius: 8 }}
                        barSize={28}
                        dataKey="count"
                        fill="url(#doctorCasesBarGradient)"
                        name="Daily cases"
                        radius={[10, 10, 6, 6]}
                      />
                      <Line
                        dataKey="avg"
                        dot={false}
                        name="Average"
                        stroke="#F59E0B"
                        strokeDasharray="6 3"
                        strokeWidth={2}
                        type="monotone"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </DashboardPanel>
        ) : null}
      </section>

      {appointmentsEnabled ? (
        <DashboardPanel
          bodyClassName="p-0"
          footer={
            dashboardData.recentNextPage ? (
              <div className="text-center">
                <button
                  className="rounded-control border border-hairline bg-canvas px-4 py-2 text-[13px] font-semibold text-slate transition hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoadingMore}
                  onClick={handleLoadMoreRecentActivity}
                  type="button"
                >
                  {isLoadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            ) : null
          }
          title="Recent Appointments"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead className="border-b border-hairline bg-mist">
                <tr>
                  {['Patient', 'Date & Time', 'Reason', 'Diagnosis', 'Payment'].map((header) => (
                    <th
                      className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate"
                      key={header}
                      scope="col"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <SkeletonRow columns={5} index={index} key={index} />
                  ))
                ) : dashboardData.recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <DashboardEmptyState title="No completed appointments yet." />
                    </td>
                  </tr>
                ) : (
                  dashboardData.recentActivity.map((appointment, index) => {
                    const dateParts = formatDateParts(appointment.appointment_dt)

                    return (
                      <tr
                        className="animate-fade-up border-b border-hairline last:border-0 hover:bg-brand-light/30"
                        key={`${appointment.id}-${index}`}
                        style={stagger(index, 0.03)}
                      >
                        <td className="px-5 py-4 text-[14px] font-medium text-ink">
                          {getAppointmentPatientName(appointment)}
                        </td>
                        <td className="px-5 py-4 font-mono text-[12px] text-ink">
                          {dateParts.date}
                          {dateParts.time ? (
                            <>
                              <span className="px-1.5 text-slate/50">|</span>
                              {dateParts.time}
                            </>
                          ) : null}
                        </td>
                        <td
                          className="max-w-[180px] truncate px-5 py-4 text-[13px] text-slate"
                          title={appointment.reason || 'No reason provided'}
                        >
                          {appointment.reason || '-'}
                        </td>
                        <td
                          className="max-w-[200px] truncate px-5 py-4 text-[13px] text-slate"
                          title={appointment.diagnosis || ''}
                        >
                          {appointment.diagnosis || '-'}
                        </td>
                        <td className="px-5 py-4">
                          <PaymentBadge status={appointment.payment_status} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
      ) : null}
    </div>
  )
}

export default DoctorDashboard
