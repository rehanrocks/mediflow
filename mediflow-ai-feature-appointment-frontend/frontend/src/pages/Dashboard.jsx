/* src/pages/Dashboard.jsx - Shows sample-style clinic metrics from live or demo data. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart2,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ServerCrash,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import SkeletonRow from '../components/SkeletonRow'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useCountUp } from '../lib/countUp'
import { stagger } from '../lib/motion'
import { getAppointments, getPatients } from '../services/api'

function normalizeList(response) {
  if (Array.isArray(response)) {
    return response
  }

  if (Array.isArray(response?.results)) {
    return response.results
  }

  return []
}

function getRecordId(record) {
  return record?.id ?? record?.pk ?? record?.uuid
}

function getPersonName(person, fallback = 'Unknown') {
  if (!person) {
    return fallback
  }

  if (typeof person === 'string' || typeof person === 'number') {
    return String(person)
  }

  return (
    person.full_name ||
    [person.first_name, person.last_name].filter(Boolean).join(' ') ||
    person.name ||
    person.username ||
    person.email ||
    fallback
  )
}

function getDateKey(date) {
  return date.toLocaleDateString('en-CA')
}

function getAppointmentDate(appointment) {
  const value = appointment.appointment_dt || appointment.date

  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function getLastSevenDays() {
  const today = new Date()

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setHours(0, 0, 0, 0)
    date.setDate(today.getDate() - (6 - index))

    return {
      key: getDateKey(date),
      label: date.toLocaleDateString('en-US', {
        weekday: 'short',
      }),
      appointments: 0,
    }
  })
}

function formatTime(value) {
  const date = getAppointmentDate({ appointment_dt: value })

  if (!date) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getPatientName(appointment, patients) {
  if (appointment.patient_name) {
    return appointment.patient_name
  }

  if (typeof appointment.patient === 'object') {
    return getPersonName(appointment.patient, 'Unknown patient')
  }

  const patient = patients.find(
    (candidate) => String(getRecordId(candidate)) === String(appointment.patient),
  )

  return getPersonName(patient, 'Unknown patient')
}

function isOpenAppointment(appointment) {
  const status = String(appointment.status || '').toLowerCase()

  return status !== 'completed' && status !== 'cancelled'
}

function getBackendError(error, fallback) {
  return error?.detail || error?.response?.data?.detail || fallback
}

function StatCard({ context, icon: Icon, index, label, tone, value }) {
  const count = useCountUp(value)

  return (
    <article
      className="animate-fade-up rounded-card border border-hairline bg-canvas p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(20,24,31,0.08)]"
      style={stagger(index, 0.06)}
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

function DashboardError({ message, onRetry }) {
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

function EmptyChart() {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center rounded-control border border-dashed border-hairline px-6 text-center">
      <BarChart2 aria-hidden="true" className="h-10 w-10 text-brand/30" />
      <h3 className="mt-4 text-[16px] font-semibold text-ink">
        Not enough trend data
      </h3>
      <p className="mt-1 max-w-sm text-[14px] font-normal leading-6 text-slate">
        The appointment chart appears after appointments exist on at least two
        separate days.
      </p>
    </div>
  )
}

function ChartTooltip({ active, label, payload }) {
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

function Panel({ action, children, title }) {
  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-canvas shadow-card">
      <div className="flex h-12 items-center justify-between border-b border-hairline px-5">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {action ? (
          <span className="text-[12px] font-semibold text-brand">{action}</span>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function Dashboard() {
  const { hasFeature, user } = useAuth()
  const publicTesting = !user
  const appointmentsEnabled = publicTesting || hasFeature('appointments')
  const patientsEnabled = publicTesting || hasFeature('patients')
  const chartRef = useRef(null)
  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboardData = useCallback(async (isMounted = () => true) => {
    if (!appointmentsEnabled && !patientsEnabled) {
      setAppointments([])
      setPatients([])
      setError('')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const [appointmentsResponse, patientsResponse] = await Promise.all([
        appointmentsEnabled ? getAppointments() : Promise.resolve([]),
        patientsEnabled ? getPatients() : Promise.resolve([]),
      ])

      if (!isMounted()) {
        return
      }

      setAppointments(normalizeList(appointmentsResponse))
      setPatients(normalizeList(patientsResponse))
    } catch (dashboardError) {
      if (!isMounted()) {
        return
      }

      setError(getBackendError(dashboardError, 'Dashboard data could not be loaded.'))
    } finally {
      if (isMounted()) {
        setIsLoading(false)
      }
    }
  }, [appointmentsEnabled, patientsEnabled])

  useEffect(() => {
    let mounted = true
    loadDashboardData(() => mounted)
    return () => {
      mounted = false
    }
  }, [loadDashboardData])

  const todayAppointmentCount = useMemo(() => {
    const todayKey = getDateKey(new Date())

    return appointments.filter((appointment) => {
      const date = getAppointmentDate(appointment)
      return date && getDateKey(date) === todayKey
    }).length
  }, [appointments])

  const openAppointmentCount = useMemo(
    () => appointments.filter(isOpenAppointment).length,
    [appointments],
  )

  const completedAppointmentCount = useMemo(
    () =>
      appointments.filter(
        (appointment) => String(appointment.status || '').toLowerCase() === 'completed',
      ).length,
    [appointments],
  )

  const chartData = useMemo(() => {
    const days = getLastSevenDays()
    const dayMap = new Map(days.map((day) => [day.key, day]))

    appointments.forEach((appointment) => {
      const date = getAppointmentDate(appointment)

      if (!date) {
        return
      }

      const day = dayMap.get(getDateKey(date))

      if (day) {
        day.appointments += 1
      }
    })

    return days
  }, [appointments])

  const statusData = useMemo(() => {
    const counts = appointments.reduce(
      (totals, appointment) => {
        const status = String(appointment.status || 'scheduled').toLowerCase()
        totals[status] = (totals[status] || 0) + 1
        return totals
      },
      {
        scheduled: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
      },
    )

    return [
      { label: 'Scheduled', count: counts.scheduled },
      { label: 'In Progress', count: counts.in_progress },
      { label: 'Completed', count: counts.completed },
      { label: 'Cancelled', count: counts.cancelled },
    ]
  }, [appointments])

  const realAppointmentDays = useMemo(
    () => chartData.filter((day) => day.appointments > 0).length,
    [chartData],
  )

  const upcomingAppointments = useMemo(() => {
    const now = new Date()

    return appointments
      .filter((appointment) => {
        const date = getAppointmentDate(appointment)
        const status = String(appointment.status || '').toLowerCase()
        return date && date >= now && status !== 'cancelled'
      })
      .sort((first, second) => getAppointmentDate(first) - getAppointmentDate(second))
      .slice(0, 3)
  }, [appointments])

  const recentPatients = useMemo(() => patients.slice(0, 3), [patients])

  useEffect(() => {
    if (!appointmentsEnabled || realAppointmentDays < 2) {
      return
    }

    const path = chartRef.current?.querySelector('.recharts-line-curve')

    if (!path) {
      return
    }

    const length = path.getTotalLength()
    path.style.strokeDasharray = length
    path.style.strokeDashoffset = length
    path.getBoundingClientRect()
    path.style.transition = 'stroke-dashoffset 1000ms ease-in-out'
    path.style.strokeDashoffset = 0
  }, [appointmentsEnabled, chartData, realAppointmentDays])

  if (!appointmentsEnabled && !patientsEnabled) {
    return (
      <section className="rounded-card bg-canvas p-10 text-center shadow-card">
        <h2 className="text-[16px] font-semibold text-ink">
          No features enabled yet
        </h2>
        <p className="mt-1 text-[14px] font-normal text-slate">
          Contact your administrator.
        </p>
      </section>
    )
  }

  if (error) {
    return (
      <DashboardError
        message={error}
        onRetry={() => loadDashboardData()}
      />
    )
  }

  const statCards = [
    patientsEnabled
      ? {
          icon: Users,
          label: 'Active Patients',
          value: patients.length,
          context: '+12 this week',
          tone: 'bg-brand-light text-brand',
        }
      : null,
    appointmentsEnabled
      ? {
          icon: CalendarClock,
          label: "Today's Appointments",
          value: todayAppointmentCount,
          context: `${openAppointmentCount} still open`,
          tone: 'bg-[#E0F2FE] text-[#0284C7]',
        }
      : null,
    appointmentsEnabled
      ? {
          icon: ClipboardList,
          label: 'Open Appointments',
          value: openAppointmentCount,
          context: 'Scheduled or in progress',
          tone: 'bg-status-inProgress-bg text-status-inProgress-text',
        }
      : null,
    appointmentsEnabled
      ? {
          icon: CheckCircle2,
          label: 'Completed Visits',
          value: completedAppointmentCount,
          context: 'Closed appointment records',
          tone: 'bg-status-completed-bg text-status-completed-text',
        }
      : null,
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? statCards.map((card, index) => (
              <SkeletonRow index={index} key={card.label} variant="stat" />
            ))
          : statCards.map((card, index) => (
              <StatCard
                context={card.context}
                icon={card.icon}
                index={index}
                key={card.label}
                label={card.label}
                tone={card.tone}
                value={card.value}
              />
            ))}
      </section>

      {appointmentsEnabled ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <Panel action="Last 7 days" title="Patient Engagement">
            {isLoading ? (
              <div className="h-[260px] rounded-control bg-mist p-4">
                <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
              </div>
            ) : realAppointmentDays >= 2 ? (
              <div className="h-[260px]" ref={chartRef}>
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={chartData} margin={{ bottom: 0, left: -18, right: 12, top: 8 }}>
                    <CartesianGrid
                      stroke="#E4E8EB"
                      strokeDasharray="4 4"
                      vertical
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      fontFamily="Outfit, sans-serif"
                      fontSize={11}
                      tickLine={false}
                      tick={{ fill: '#5B6472', fontWeight: 400 }}
                      tickMargin={12}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      fontFamily="Outfit, sans-serif"
                      fontSize={11}
                      tickLine={false}
                      tick={{ fill: '#5B6472', fontWeight: 400 }}
                      tickMargin={10}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#E4E8EB' }} />
                    <Line
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      dataKey="appointments"
                      dot={false}
                      name="Appointments"
                      stroke="#4338CA"
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart />
            )}
          </Panel>

          <Panel action="Current records" title="Status Distribution">
            <div className="h-[260px]">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={statusData} margin={{ bottom: 0, left: -18, right: 12, top: 8 }}>
                  <CartesianGrid
                    stroke="#E4E8EB"
                    strokeDasharray="4 4"
                    vertical
                  />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    fontFamily="Outfit, sans-serif"
                    fontSize={11}
                    tickLine={false}
                    tick={{ fill: '#5B6472', fontWeight: 400 }}
                    tickMargin={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    fontFamily="Outfit, sans-serif"
                    fontSize={11}
                    tickLine={false}
                    tick={{ fill: '#5B6472', fontWeight: 400 }}
                    tickMargin={10}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F6F8F9' }} />
                  <Bar
                    dataKey="count"
                    fill="#4338CA"
                    name="Appointments"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-3">
        {appointmentsEnabled ? (
          <Panel action="Schedule" title="Upcoming Appointments">
            <div className="space-y-4">
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.map((appointment, index) => (
                  <div
                    className="flex animate-fade-up items-center justify-between gap-4 border-b border-hairline pb-4 last:border-0 last:pb-0"
                    key={getRecordId(appointment)}
                    style={stagger(index, 0.04)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-ink">
                        {getPatientName(appointment, patients)}
                      </p>
                      <p className="mt-1 truncate text-[12px] font-medium text-slate">
                        {appointment.reason || 'Clinic visit'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[12px] font-medium text-slate">
                        {formatTime(appointment.appointment_dt)}
                      </p>
                      <div className="mt-1">
                        <StatusBadge status={appointment.status || 'scheduled'} />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[14px] font-medium text-slate">
                  No upcoming appointments.
                </p>
              )}
            </div>
          </Panel>
        ) : null}

        {patientsEnabled ? (
          <Panel action="View all" title="Recent Patients">
            <div className="space-y-4">
              {recentPatients.map((patient, index) => (
                <div
                  className="flex animate-fade-up items-center justify-between gap-4 border-b border-hairline pb-4 last:border-0 last:pb-0"
                  key={getRecordId(patient)}
                  style={stagger(index, 0.04)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {getPersonName(patient, 'Unnamed patient')}
                    </p>
                    <p className="mt-1 truncate text-[12px] font-medium text-slate">
                      {patient.condition || 'No condition recorded'}
                    </p>
                  </div>
                  <p className="font-mono text-[12px] font-medium text-slate">
                    {patient.age ?? '-'} yrs
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel action="Derived" title="Clinic Insights">
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-control bg-brand-light p-3">
              <CalendarCheck aria-hidden="true" className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <p className="text-[13px] font-semibold text-ink">Today’s load</p>
                <p className="mt-1 text-[12px] font-medium leading-5 text-slate">
                  {todayAppointmentCount} appointments are scheduled for today.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-control bg-status-inProgress-bg p-3">
              <Activity
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 text-status-inProgress-text"
              />
              <div>
                <p className="text-[13px] font-semibold text-ink">Open queue</p>
                <p className="mt-1 text-[12px] font-medium leading-5 text-slate">
                  {openAppointmentCount} appointment records still need follow-up.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-control bg-status-cancelled-bg p-3">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 text-status-cancelled-text"
              />
              <div>
                <p className="text-[13px] font-semibold text-ink">Data source</p>
                <p className="mt-1 text-[12px] font-medium leading-5 text-slate">
                  Demo data is active when backend access is unavailable.
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  )
}

export default Dashboard
