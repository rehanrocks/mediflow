import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  CalendarClock,
  Stethoscope,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link } from 'react-router-dom'

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
import RoleBadge from '@shared/components/staff/RoleBadge'
import { useAuth } from '@shared/context/AuthContext'
import { isAdmin } from '@shared/lib/permissions'
import {
  formatDate,
  getAppointmentDate,
  getAppointmentDoctorName,
  getAppointmentPatientName,
  getBackendError,
  getPatientConditions,
  getPatientName,
  normalizeList,
} from '@shared/lib/records'
import { stagger } from '@shared/lib/motion'
import {
  getAppointments,
  getDoctors,
  getPatients,
  getStaff,
} from '@shared/services/api'

const CARD_GRID_CLASSES = {
  1: 'grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 xl:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
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

function formatTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getPatientCreatedAt(patient) {
  return patient?.created_at || patient?.onboarding_date || ''
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

export function AdminDashboard() {
  const { hasFeature, user } = useAuth()
  const appointmentsEnabled = hasFeature('appointments')
  const patientsEnabled = hasFeature('patients')
  const doctorsEnabled = hasFeature('doctors')
  const staffEnabled = hasFeature('staff') && isAdmin(user)
  const chartRef = useRef(null)
  const [dashboardData, setDashboardData] = useState({
    allAppointments: [],
    doctors: [],
    patients: [],
    staff: [],
    todayAppointments: [],
    totalDoctors: 0,
    totalPatients: 0,
    totalStaff: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const loadDashboardData = useCallback(async (isMounted = () => true) => {
    if (!appointmentsEnabled && !patientsEnabled && !doctorsEnabled && !staffEnabled) {
      setDashboardData({
        allAppointments: [],
        doctors: [],
        patients: [],
        staff: [],
        todayAppointments: [],
        totalDoctors: 0,
        totalPatients: 0,
        totalStaff: 0,
      })
      setLoadError('')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError('')

    try {
      const [
        todayAppointmentsResponse,
        allAppointmentsResponse,
        patientsResponse,
        doctorsResponse,
        staffResponse,
      ] = await Promise.all([
        appointmentsEnabled
          ? getAppointments({ ordering: 'appointment_dt', period: 'day' })
          : Promise.resolve([]),
        appointmentsEnabled
          ? getAppointments({ ordering: 'appointment_dt' })
          : Promise.resolve([]),
        patientsEnabled ? getPatients() : Promise.resolve([]),
        doctorsEnabled ? getDoctors() : Promise.resolve([]),
        staffEnabled ? getStaff() : Promise.resolve([]),
      ])

      if (!isMounted()) {
        return
      }

      const todayAppointments = normalizeList(todayAppointmentsResponse)
        .filter((appointment) => isSameDay(appointment.appointment_dt))
        .sort((first, second) => getAppointmentDate(first) - getAppointmentDate(second))
      const allAppointments = normalizeList(allAppointmentsResponse)
      const patients = normalizeList(patientsResponse)
      const doctors = normalizeList(doctorsResponse)
      const staff = normalizeList(staffResponse)

      setDashboardData({
        allAppointments,
        doctors,
        patients,
        staff,
        todayAppointments,
        totalDoctors: getCount(doctorsResponse),
        totalPatients: getCount(patientsResponse),
        totalStaff: getCount(staffResponse),
      })
    } catch (error) {
      if (!isMounted()) {
        return
      }

      setLoadError(getBackendError(error, 'Dashboard data could not be loaded.'))
    } finally {
      if (isMounted()) {
        setIsLoading(false)
      }
    }
  }, [appointmentsEnabled, doctorsEnabled, patientsEnabled, staffEnabled])

  useEffect(() => {
    let mounted = true

    queueMicrotask(() => {
      loadDashboardData(() => mounted)
    })

    return () => {
      mounted = false
    }
  }, [loadDashboardData])

  const chartData = useMemo(() => {
    const days = getLastSevenDays()
    const dayMap = new Map(days.map((day) => [day.key, day]))

    dashboardData.allAppointments.forEach((appointment) => {
      const date = getAppointmentDate(appointment)

      if (!date) {
        return
      }

      const targetDay = dayMap.get(getDateKey(date))

      if (targetDay) {
        targetDay.appointments += 1
      }
    })

    return days
  }, [dashboardData.allAppointments])

  const realAppointmentDays = useMemo(
    () => chartData.filter((day) => day.appointments > 0).length,
    [chartData],
  )

  const todayScheduledCount = useMemo(
    () =>
      dashboardData.todayAppointments.filter(
        (appointment) => String(appointment.status || '').toLowerCase() === 'scheduled',
      ).length,
    [dashboardData.todayAppointments],
  )

  const todayCompletedCount = useMemo(
    () =>
      dashboardData.todayAppointments.filter(
        (appointment) => String(appointment.status || '').toLowerCase() === 'completed',
      ).length,
    [dashboardData.todayAppointments],
  )

  const joinedThisMonthCount = useMemo(() => {
    const currentMonth = getDateKey(new Date()).slice(0, 7)

    return dashboardData.patients.filter((patient) =>
      getDateKey(getPatientCreatedAt(patient)).startsWith(currentMonth),
    ).length
  }, [dashboardData.patients])

  const activeDoctors = useMemo(
    () =>
      dashboardData.doctors.filter(
        (doctor) => String(doctor.status || '').toLowerCase() === 'active',
      ),
    [dashboardData.doctors],
  )

  const activeStaff = useMemo(
    () =>
      dashboardData.staff.filter(
        (staffMember) => String(staffMember.status || '').toLowerCase() === 'active',
      ),
    [dashboardData.staff],
  )

  const inactiveStaff = useMemo(
    () =>
      dashboardData.staff.filter(
        (staffMember) => String(staffMember.status || '').toLowerCase() !== 'active',
      ),
    [dashboardData.staff],
  )

  const staffRoleCount = useMemo(
    () =>
      new Set(
        dashboardData.staff
          .map((staffMember) => String(staffMember.role || '').trim())
          .filter(Boolean),
      ).size,
    [dashboardData.staff],
  )

  const doctorsOnDuty = useMemo(
    () =>
      activeDoctors
        .filter((doctor) => doctor.today_checkin)
        .sort((first, second) => new Date(first.today_checkin) - new Date(second.today_checkin)),
    [activeDoctors],
  )

  const recentPatients = useMemo(
    () =>
      [...dashboardData.patients]
        .sort(
          (first, second) =>
            new Date(getPatientCreatedAt(second)) - new Date(getPatientCreatedAt(first)),
        )
        .slice(0, 5),
    [dashboardData.patients],
  )

  const appointmentStatusData = useMemo(() => {
    const statusCounts = dashboardData.allAppointments.reduce((counts, appointment) => {
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
  }, [dashboardData.allAppointments])

  const doctorWorkloadData = useMemo(
    () =>
      activeDoctors
        .map((doctor) => ({
          cases: Number(doctor.cases_today || 0),
          label:
            doctor.last_name ||
            String(doctor.full_name || 'Doctor').split(' ').at(-1) ||
            'Doctor',
        }))
        .sort((first, second) => second.cases - first.cases)
        .slice(0, 6),
    [activeDoctors],
  )

  const statCards = useMemo(
    () =>
      [
        appointmentsEnabled
          ? {
              context: `${todayScheduledCount} scheduled · ${todayCompletedCount} completed`,
              icon: CalendarClock,
              label: "Today's Appointments",
              tone: 'bg-[#E0F2FE] text-[#0284C7]',
              value: dashboardData.todayAppointments.length,
            }
          : null,
        patientsEnabled
          ? {
              context: `+${joinedThisMonthCount} this month`,
              icon: Users,
              label: 'Total Patients',
              tone: 'bg-brand-light text-brand',
              value: dashboardData.totalPatients,
            }
          : null,
        doctorsEnabled
          ? {
              context: `of ${dashboardData.totalDoctors} total`,
              icon: Stethoscope,
              label: 'Active Doctors',
              tone: 'bg-[#ECFDF5] text-[#047857]',
              value: activeDoctors.length,
            }
          : null,
        staffEnabled
          ? {
              context: `${staffRoleCount} roles`,
              icon: BadgeCheck,
              label: 'Active Staff',
              tone: 'bg-[#FFF7ED] text-[#C2410C]',
              value: activeStaff.length,
            }
          : null,
      ].filter(Boolean),
    [
      activeDoctors.length,
      activeStaff.length,
      appointmentsEnabled,
      dashboardData.todayAppointments.length,
      dashboardData.totalDoctors,
      dashboardData.totalPatients,
      doctorsEnabled,
      joinedThisMonthCount,
      patientsEnabled,
      staffEnabled,
      staffRoleCount,
      todayCompletedCount,
      todayScheduledCount,
    ],
  )

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

  if (!appointmentsEnabled && !patientsEnabled && !doctorsEnabled && !staffEnabled) {
    return (
      <section className="rounded-card bg-canvas p-10 text-center shadow-card">
        <h2 className="text-[16px] font-semibold text-ink">No features enabled yet</h2>
        <p className="mt-1 text-[14px] font-normal text-slate">
          Contact your administrator.
        </p>
      </section>
    )
  }

  if (loadError) {
    return <DashboardErrorState message={loadError} onRetry={() => loadDashboardData()} />
  }

  return (
    <div className="space-y-5">
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
                  tone={card.tone}
                  value={card.value}
                />
              ))}
        </section>
      ) : null}

      {appointmentsEnabled || doctorsEnabled ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {appointmentsEnabled ? (
            <DashboardPanel action="View all" actionTo="/appointments" bodyClassName="p-0" title="Today's Appointments">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <thead className="border-b border-hairline bg-mist">
                    <tr>
                      {['Patient', 'Doctor', 'Time', 'Status', 'Payment'].map((header) => (
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
                    ) : dashboardData.todayAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <DashboardEmptyState title="No appointments today" />
                        </td>
                      </tr>
                    ) : (
                      dashboardData.todayAppointments.slice(0, 5).map((appointment, index) => (
                        <tr
                          className="animate-fade-up border-b border-hairline last:border-0 hover:bg-brand-light/30"
                          key={appointment.id}
                          style={stagger(index, 0.04)}
                        >
                          <td className="px-5 py-4 text-[14px] font-medium text-ink">
                            {getAppointmentPatientName(appointment)}
                          </td>
                          <td className="px-5 py-4 text-[13px] text-slate">
                            {getAppointmentDoctorName(appointment, dashboardData.doctors)}
                          </td>
                          <td className="px-5 py-4 font-mono text-[12px] font-medium text-ink">
                            {formatTime(appointment.appointment_dt)}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={appointment.status} />
                          </td>
                          <td className="px-5 py-4">
                            <PaymentBadge status={appointment.payment_status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </DashboardPanel>
          ) : null}

          {doctorsEnabled ? (
            <DashboardPanel
              action={doctorsOnDuty.length > 6 ? `+${doctorsOnDuty.length - 6} more` : null}
              actionTo={doctorsOnDuty.length > 6 ? '/doctors' : undefined}
              title="Doctors Today"
            >
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      className="animate-fade-up flex items-center gap-3 rounded-control border border-hairline px-3 py-3"
                      key={index}
                      style={stagger(index, 0.04)}
                    >
                      <div className="h-9 w-9 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-28 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                        <div className="h-3 w-20 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : doctorsOnDuty.length === 0 ? (
                <DashboardEmptyState title="No check-ins recorded today" />
              ) : (
                <div className="space-y-3">
                  {doctorsOnDuty.slice(0, 6).map((doctor, index) => (
                    <div
                      className="animate-fade-up flex items-center gap-3 rounded-control border border-hairline px-3 py-3"
                      key={doctor.id}
                      style={stagger(index, 0.04)}
                    >
                      <Avatar name={doctor.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-ink">
                          {doctor.full_name}
                        </p>
                        <p className="font-mono text-[11px] text-slate">
                          Arrived {formatTime(doctor.today_checkin)}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-light px-2.5 py-1 font-mono text-[11px] font-semibold text-brand">
                        {Number(doctor.cases_today || 0)} cases
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </DashboardPanel>
          ) : null}
        </section>
      ) : null}

      {appointmentsEnabled ? (
        <DashboardPanel bodyClassName="p-6" title="Appointment Activity - Last 7 Days">
          {isLoading ? (
            <div className="h-[260px] rounded-control bg-mist p-4">
              <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
            </div>
          ) : realAppointmentDays >= 2 ? (
            <div className="h-[260px]" ref={chartRef}>
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={chartData} margin={{ bottom: 0, left: -18, right: 12, top: 8 }}>
                  <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 4" vertical />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    fontFamily="Outfit, sans-serif"
                    fontSize={11}
                    tick={{ fill: '#5B6472', fontWeight: 400 }}
                    tickLine={false}
                    tickMargin={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    fontFamily="Outfit, sans-serif"
                    fontSize={11}
                    tick={{ fill: '#5B6472', fontWeight: 400 }}
                    tickLine={false}
                    tickMargin={10}
                  />
                  <Tooltip content={<DashboardChartTooltip />} cursor={{ stroke: '#E4E8EB' }} />
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
            <DashboardEmptyState
              title="Not enough trend data"
              description="The appointment chart appears after appointments exist on at least two separate days."
            />
          )}
        </DashboardPanel>
      ) : null}

      {appointmentsEnabled || doctorsEnabled ? (
        <section className="grid gap-5 xl:grid-cols-2">
          {appointmentsEnabled ? (
            <DashboardPanel bodyClassName="p-5" title="Appointment Status Mix">
              {isLoading ? (
                <div className="h-[220px] rounded-control bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : appointmentStatusData.length === 0 ? (
                <DashboardEmptyState title="No appointment status data yet" />
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={appointmentStatusData} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                      <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 4" vertical={false} />
                      <XAxis
                        axisLine={false}
                        dataKey="label"
                        fontFamily="JetBrains Mono, monospace"
                        fontSize={10}
                        tick={{ fill: '#5B6472' }}
                        tickLine={false}
                        tickMargin={10}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        fontFamily="JetBrains Mono, monospace"
                        fontSize={10}
                        tick={{ fill: '#5B6472' }}
                        tickLine={false}
                        tickMargin={8}
                      />
                      <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#F6F8F9' }} />
                      <Bar dataKey="count" name="Appointments" radius={[5, 5, 0, 0]}>
                        {appointmentStatusData.map((item) => (
                          <Cell fill={item.color} key={item.status} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DashboardPanel>
          ) : null}

          {doctorsEnabled ? (
            <DashboardPanel bodyClassName="p-5" title="Doctor Workload Today">
              {isLoading ? (
                <div className="h-[220px] rounded-control bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : doctorWorkloadData.length === 0 ? (
                <DashboardEmptyState title="No workload data yet" />
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={doctorWorkloadData} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                      <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 4" vertical={false} />
                      <XAxis
                        axisLine={false}
                        dataKey="label"
                        fontFamily="JetBrains Mono, monospace"
                        fontSize={10}
                        tick={{ fill: '#5B6472' }}
                        tickLine={false}
                        tickMargin={10}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        fontFamily="JetBrains Mono, monospace"
                        fontSize={10}
                        tick={{ fill: '#5B6472' }}
                        tickLine={false}
                        tickMargin={8}
                      />
                      <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#EEF2FF66' }} />
                      <Bar dataKey="cases" fill="#4338CA" name="Cases" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DashboardPanel>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-2">
        {patientsEnabled ? (
          <DashboardPanel action="View all" actionTo="/patients" title="Recent Patients">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    className="animate-fade-up flex items-center gap-3 rounded-control border border-hairline px-3 py-3"
                    key={index}
                    style={stagger(index, 0.04)}
                  >
                    <div className="h-9 w-9 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-28 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                      <div className="h-3 w-20 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentPatients.length === 0 ? (
              <DashboardEmptyState title="No patients yet" />
            ) : (
              <div className="space-y-3">
                {recentPatients.map((patient, index) => (
                  <div
                    className="animate-fade-up flex items-center gap-3 rounded-control border border-hairline px-3 py-3"
                    key={patient.id}
                    style={stagger(index, 0.04)}
                  >
                    <Avatar name={getPatientName(patient)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">
                        {getPatientName(patient)}
                      </p>
                      <p className="truncate text-[12px] text-slate">
                        {getPatientConditions(patient)[0] || 'No condition recorded'}
                      </p>
                    </div>
                    <p className="font-mono text-[11px] text-slate">
                      {formatDate(getPatientCreatedAt(patient))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>
        ) : null}

        {staffEnabled ? (
          <DashboardPanel
            footer={
              dashboardData.totalStaff > 5 ? (
                <Link
                  className="text-[12px] font-semibold text-brand transition hover:text-brand-dark"
                  to="/staff"
                >
                  View all
                </Link>
              ) : null
            }
            title="Staff"
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-control bg-mist px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
                  Active
                </p>
                <p className="mt-2 text-[24px] font-bold leading-none text-ink">
                  {isLoading ? '-' : activeStaff.length}
                </p>
              </div>
              <div className="rounded-control bg-mist px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
                  On Leave / Inactive
                </p>
                <p className="mt-2 text-[24px] font-bold leading-none text-ink">
                  {isLoading ? '-' : inactiveStaff.length}
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    className="animate-fade-up flex items-center gap-3 rounded-control border border-hairline px-3 py-3"
                    key={index}
                    style={stagger(index, 0.04)}
                  >
                    <div className="h-9 w-9 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 animate-shimmer rounded-full bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : dashboardData.staff.length === 0 ? (
              <DashboardEmptyState title="No staff records yet" />
            ) : (
              <div className="space-y-3">
                {dashboardData.staff.slice(0, 5).map((staffMember, index) => (
                  <div
                    className="animate-fade-up flex items-center gap-3 rounded-control border border-hairline px-3 py-3"
                    key={staffMember.id}
                    style={stagger(index, 0.04)}
                  >
                    <Avatar name={staffMember.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">
                        {staffMember.full_name}
                      </p>
                    </div>
                    <RoleBadge role={staffMember.role} />
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>
        ) : null}
      </section>
    </div>
  )
}

export default AdminDashboard
