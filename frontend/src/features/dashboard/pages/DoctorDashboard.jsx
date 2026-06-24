import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Clock3,
  Eye,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  DashboardPanel,
  DashboardStatCard,
} from '@features/dashboard/components/DashboardPrimitives'
import Avatar from '@shared/components/Avatar'
import SkeletonRow from '@shared/components/SkeletonRow'
import { useAuth } from '@shared/context/AuthContext'
import { buildGreeting } from '@shared/lib/greeting'
import { stagger } from '@shared/lib/motion'
import { getUserDoctorId, isDoctor } from '@shared/lib/permissions'
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

function CasesTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null
  }

  const entry = payload[0]?.payload

  return (
    <div className="rounded-xl border border-hairline bg-canvas px-3 py-2 shadow-card">
      <p className="font-mono text-[12px] text-slate">{entry.fullDate}</p>
      <p className="text-[14px] font-semibold text-ink">{entry.count} cases</p>
    </div>
  )
}

export function DoctorDashboard() {
  const navigate = useNavigate()
  const { hasFeature, user } = useAuth()
  const appointmentsEnabled = hasFeature('appointments')
  const patientsEnabled = hasFeature('patients')
  const doctorId = getUserDoctorId(user)
  const doctorUser = isDoctor(user)
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

  const casesChartData = useMemo(
    () =>
      (dashboardData.stats.daily_cases || []).slice(-7).map((item) => ({
        count: Number(item.count || 0),
        day: formatDayLabel(item.date),
        fullDate: formatDate(item.date),
      })),
    [dashboardData.stats.daily_cases],
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

  const statCards = useMemo(
    () =>
      [
        appointmentsEnabled
          ? {
              context: 'Today',
              icon: ClipboardList,
              label: 'Cases Today',
              tone: 'bg-brand-light text-brand',
              value: dashboardData.stats.cases_today,
            }
          : null,
        appointmentsEnabled
          ? {
              context: 'This week',
              icon: CalendarDays,
              label: 'This Week',
              tone: 'bg-[#E0F2FE] text-[#0284C7]',
              value: dashboardData.stats.cases_this_week,
            }
          : null,
        patientsEnabled
          ? {
              context: 'Assigned records',
              icon: Users,
              label: 'My Patients',
              tone: 'bg-[#ECFDF5] text-[#047857]',
              value: dashboardData.totalPatients,
            }
          : null,
        appointmentsEnabled
          ? {
              context: 'Per working day',
              icon: TrendingUp,
              label: 'Daily Average',
              precision: 1,
              tone: 'bg-[#FFF7ED] text-[#C2410C]',
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

  const supportHeroTitle = 'Doctor workspace preview'
  const supportHeroDescription =
    'Use a doctor account to view personal schedule, patient activity, and performance metrics.'
  const heroGreeting = doctorUser ? buildGreeting(user) : supportHeroTitle
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
    <div className="space-y-5">
      <section
        className="animate-fade-up overflow-hidden rounded-card p-6 text-white shadow-card"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 70% 50%, rgba(255,255,255,0.1), transparent 60%), linear-gradient(90deg, #4338CA 0%, #6366F1 100%)',
        }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[22px] font-bold text-white">{heroGreeting}</h2>
            <p className="mt-1 text-[14px] font-normal text-white/70">{heroDateLine}</p>
            <p className="mt-3 inline-flex items-center font-mono text-[13px] text-white/80">
              <Clock3 aria-hidden="true" className="mr-1.5 h-[13px] w-[13px]" />
              {shiftValue}
            </p>
          </div>

          <div className="flex flex-col text-left lg:text-right">
            <p className="font-mono text-[13px] text-white/80">Arrived {arrivalValue}</p>
            <p className="mt-2 text-[32px] font-bold leading-none text-white">
              {Number(dashboardData.stats.cases_today || 0)}
            </p>
            <p className="mt-1 text-[13px] text-white/60">cases today</p>
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
        <section className="grid gap-5 xl:grid-cols-2">
          {appointmentsEnabled ? (
            <DashboardPanel bodyClassName="p-5" title="Today's Status Mix">
              {isLoading ? (
                <div className="h-[210px] rounded-control bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : todayStatusData.length === 0 ? (
                <DashboardEmptyState title="No schedule status data yet" />
              ) : (
                <div className="h-[210px]">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={todayStatusData} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                      <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 4" vertical={false} />
                      <XAxis
                        axisLine={false}
                        dataKey="label"
                        tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                        tickLine={false}
                        tickMargin={10}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                        tickLine={false}
                        tickMargin={8}
                      />
                      <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#F6F8F9' }} />
                      <Bar dataKey="count" name="Appointments" radius={[5, 5, 0, 0]}>
                        {todayStatusData.map((item) => (
                          <Cell fill={item.color} key={item.status} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DashboardPanel>
          ) : null}

          {patientsEnabled ? (
            <DashboardPanel bodyClassName="p-5" title="My Patient Conditions">
              {isLoading ? (
                <div className="h-[210px] rounded-control bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : patientConditionData.length === 0 ? (
                <DashboardEmptyState title="No condition data yet" />
              ) : (
                <div className="h-[210px]">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart
                      data={patientConditionData}
                      layout="vertical"
                      margin={{ bottom: 0, left: 18, right: 8, top: 8 }}
                    >
                      <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 4" horizontal={false} />
                      <XAxis
                        allowDecimals={false}
                        axisLine={false}
                        tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                        tickLine={false}
                        type="number"
                      />
                      <YAxis
                        axisLine={false}
                        dataKey="label"
                        tick={{ fill: '#5B6472', fontSize: 10 }}
                        tickLine={false}
                        type="category"
                        width={116}
                      />
                      <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#EEF2FF66' }} />
                      <Bar dataKey="count" fill="#4338CA" name="Patients" radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
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
          <DashboardPanel bodyClassName="p-5" title="My Cases - Last 7 Days">
            {isLoading ? (
              <div className="h-[180px] rounded-control bg-mist p-4">
                <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
              </div>
            ) : casesChartData.length < 2 ? (
              <DashboardEmptyState title="Not enough data yet" />
            ) : (
              <div className="h-[180px]">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={casesChartData} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                    <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="day"
                      tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                      tickLine={false}
                      tickMargin={10}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tick={{ fill: '#5B6472', fontFamily: 'JetBrains Mono', fontSize: 10 }}
                      tickLine={false}
                      tickMargin={8}
                    />
                    <Tooltip content={<CasesTooltip />} cursor={{ fill: '#EEF2FF55' }} />
                    <Bar dataKey="count" fill="#EEF2FF" radius={[4, 4, 0, 0]} stroke="#4338CA" />
                  </BarChart>
                </ResponsiveContainer>
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
