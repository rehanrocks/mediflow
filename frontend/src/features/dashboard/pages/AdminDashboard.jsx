import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  HeartPulse,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link, Navigate } from 'react-router-dom'

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
import RoleBadge from '@shared/components/staff/RoleBadge'
import { usePermission } from '@shared/lib/usePermission'
import {
  formatDate,
  getAppointmentDate,
  getAppointmentDoctorName,
  getAppointmentPatientName,
  getBackendError,
  getDoctorName,
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

const GENDER_COLORS = {
  Female: '#0D9488',
  Male: '#4338CA',
  Other: '#F59E0B',
}

const APPOINTMENT_PERIODS = [
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
]

const APPOINTMENT_FLOW_KEYS = [
  ['scheduled', 'Scheduled'],
  ['inProgress', 'In Progress'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
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

function createAppointmentTrendBucket(base) {
  return {
    ...base,
    appointments: 0,
    cancelled: 0,
    completed: 0,
    inProgress: 0,
    scheduled: 0,
  }
}

function getAppointmentFlowKey(status) {
  const normalizedStatus = String(status || 'scheduled').toLowerCase()

  if (normalizedStatus === 'completed') return 'completed'
  if (normalizedStatus === 'cancelled') return 'cancelled'
  if (normalizedStatus === 'in_progress') return 'inProgress'

  return 'scheduled'
}

function getAppointmentTrendBuckets(period) {
  const today = new Date()

  if (period === 'year') {
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(today)
      date.setDate(1)
      date.setMonth(today.getMonth() - (11 - index))

      return createAppointmentTrendBucket({
        key: date.toISOString().slice(0, 7),
        label: date.toLocaleDateString('en-US', { month: 'short' }),
      })
    })
  }

  const length = period === 'month' ? 30 : 7

  return Array.from({ length }, (_, index) => {
    const date = new Date(today)
    date.setHours(0, 0, 0, 0)
    date.setDate(today.getDate() - (length - 1 - index))

    return createAppointmentTrendBucket({
      key: getDateKey(date),
      label:
        period === 'month'
          ? date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
          : date.toLocaleDateString('en-US', { weekday: 'short' }),
    })
  })
}

function addRollingAverage(data) {
  return data.map((day, index, days) => {
    const window = days.slice(Math.max(0, index - 6), index + 1)
    const average =
      window.reduce((sum, item) => sum + Number(item.appointments || 0), 0) /
      window.length

    return {
      ...day,
      rollingAverage: Number(average.toFixed(1)),
    }
  })
}

export function AdminDashboard() {
  const { canRead, role } = usePermission()
  const appointmentsEnabled = canRead('appointments')
  const patientsEnabled = canRead('patients')
  const doctorsEnabled = canRead('doctors')
  const staffEnabled = canRead('staff')
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
  const [appointmentPeriod, setAppointmentPeriod] = useState('week')

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
    const days = getAppointmentTrendBuckets(appointmentPeriod)
    const dayMap = new Map(days.map((day) => [day.key, day]))

    dashboardData.allAppointments.forEach((appointment) => {
      const date = getAppointmentDate(appointment)

      if (!date) {
        return
      }

      const targetDay = dayMap.get(
        appointmentPeriod === 'year'
          ? getDateKey(date).slice(0, 7)
          : getDateKey(date),
      )

      if (targetDay) {
        const flowKey = getAppointmentFlowKey(appointment.status)
        targetDay.appointments += 1
        targetDay[flowKey] += 1
      }
    })

    return addRollingAverage(days)
  }, [appointmentPeriod, dashboardData.allAppointments])

  const realAppointmentDays = useMemo(
    () => chartData.filter((day) => day.appointments > 0).length,
    [chartData],
  )

  const adminHeroSparkline = useMemo(
    () => chartData.map((day) => day.appointments),
    [chartData],
  )

  const adminHeroSparkLabels = useMemo(() => {
    if (chartData.length === 0) {
      return ['Start', 'Mid', 'Now']
    }

    return [
      chartData[0]?.label || 'Start',
      chartData[Math.floor(chartData.length / 2)]?.label || 'Mid',
      chartData.at(-1)?.label || 'Now',
    ]
  }, [chartData])

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

  const todayOpenCount = useMemo(
    () =>
      dashboardData.todayAppointments.filter((appointment) => {
        const status = String(appointment.status || '').toLowerCase()
        return status !== 'completed' && status !== 'cancelled'
      }).length,
    [dashboardData.todayAppointments],
  )

  const completionRate = dashboardData.todayAppointments.length
    ? Math.round((todayCompletedCount / dashboardData.todayAppointments.length) * 100)
    : 0

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

  const doctorCoverage = dashboardData.totalDoctors
    ? Math.round((activeDoctors.length / dashboardData.totalDoctors) * 100)
    : 0
  const staffCoverage = dashboardData.totalStaff
    ? Math.round((activeStaff.length / dashboardData.totalStaff) * 100)
    : 0
  const operationsScore = Math.round(
    (dashboardData.todayAppointments.length ? completionRate : 0) * 0.45 +
      doctorCoverage * 0.3 +
      staffCoverage * 0.25,
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
            getDoctorName(doctor).split(' ').at(-1) ||
            'Doctor',
        }))
        .sort((first, second) => second.cases - first.cases)
        .slice(0, 6),
    [activeDoctors],
  )

  const patientGenderData = useMemo(() => {
    const counts = {
      Female: 0,
      Male: 0,
      Other: 0,
    }

    dashboardData.patients.forEach((patient) => {
      const sex = String(patient.sex || '').trim().toLowerCase()

      if (sex === 'male') {
        counts.Male += 1
      } else if (sex === 'female') {
        counts.Female += 1
      } else {
        counts.Other += 1
      }
    })

    return Object.entries(counts)
      .map(([label, count]) => ({
        color: GENDER_COLORS[label],
        count,
        label,
      }))
      .filter((item) => item.count > 0)
  }, [dashboardData.patients])

  const totalGenderPatients = useMemo(
    () => patientGenderData.reduce((sum, item) => sum + item.count, 0),
    [patientGenderData],
  )

  const appointmentStatusTotal = useMemo(
    () => appointmentStatusData.reduce((sum, item) => sum + item.count, 0),
    [appointmentStatusData],
  )

  const appointmentStatusPeak = useMemo(
    () => Math.max(1, ...appointmentStatusData.map((item) => item.count)),
    [appointmentStatusData],
  )

  const workloadTotal = useMemo(
    () => doctorWorkloadData.reduce((sum, item) => sum + item.cases, 0),
    [doctorWorkloadData],
  )

  const workloadPeak = useMemo(
    () => Math.max(1, ...doctorWorkloadData.map((item) => item.cases)),
    [doctorWorkloadData],
  )

  const busiestDoctor = doctorWorkloadData[0]
  const leadingGender = useMemo(
    () =>
      patientGenderData.reduce(
        (leader, item) => (item.count > (leader?.count || 0) ? item : leader),
        null,
      ),
    [patientGenderData],
  )

  const statCards = useMemo(
    () =>
      [
        appointmentsEnabled
          ? {
              context: `${todayOpenCount} open - ${todayCompletedCount} completed`,
              icon: CalendarClock,
              label: "Today's Appointments",
              tone: 'bg-[#FCE7F3] text-[#DB2777]',
              value: dashboardData.todayAppointments.length,
            }
          : null,
        patientsEnabled
          ? {
              context: `+${joinedThisMonthCount} this month`,
              icon: Users,
              label: 'Total Patients',
              tone: 'bg-[#F3E8FF] text-[#7C3AED]',
              value: dashboardData.totalPatients,
            }
          : null,
        doctorsEnabled
          ? {
              context: `of ${dashboardData.totalDoctors} total`,
              icon: Stethoscope,
              label: 'Active Doctors',
              tone: 'bg-[#E0F2FE] text-[#0284C7]',
              value: activeDoctors.length,
            }
          : null,
        staffEnabled
          ? {
              context: `${staffRoleCount} roles`,
              icon: BadgeCheck,
              label: 'Active Staff',
              tone: 'bg-[#ECFDF5] text-[#059669]',
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
      todayOpenCount,
    ],
  )

  const adminSignals = useMemo(
    () => [
      {
        context: `${todayScheduledCount} scheduled`,
        icon: CalendarCheck,
        label: 'Schedule Flow',
        tone: 'bg-[#FCE7F3] text-[#DB2777]',
        value: `${todayOpenCount} open`,
      },
      {
        context: `${doctorCoverage}% active`,
        icon: HeartPulse,
        label: 'Care Capacity',
        tone: 'bg-[#E0F2FE] text-[#0284C7]',
        value: `${activeDoctors.length}/${dashboardData.totalDoctors || 0}`,
      },
      {
        context: `${staffCoverage}% covered`,
        icon: ShieldCheck,
        label: 'Ops Coverage',
        tone: 'bg-[#ECFDF5] text-[#059669]',
        value: `${activeStaff.length}/${dashboardData.totalStaff || 0}`,
      },
    ],
    [
      activeDoctors.length,
      activeStaff.length,
      dashboardData.totalDoctors,
      dashboardData.totalStaff,
      doctorCoverage,
      staffCoverage,
      todayOpenCount,
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

  if (role?.slug === 'doctor') {
    return <Navigate replace to="/dashboard/doctor" />
  }

  if (!appointmentsEnabled && !patientsEnabled && !doctorsEnabled && !staffEnabled) {
    return (
      <section className="rounded-card bg-canvas p-10 text-center shadow-card">
        <LayoutDashboard
          aria-hidden="true"
          className="mx-auto mb-4 h-10 w-10 text-brand/20"
        />
        <h2 className="text-[14px] font-semibold text-slate">
          Nothing to show on your dashboard yet
        </h2>
        <p className="mt-1 text-[13px] font-normal text-slate">
          Contact your admin if you believe this is incorrect.
        </p>
      </section>
    )
  }

  if (loadError) {
    return <DashboardErrorState message={loadError} onRetry={() => loadDashboardData()} />
  }

  return (
    <div className="dashboard-stage space-y-5">
      <section className="relative overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(135deg,#FFFFFF_0%,#F7FAFC_52%,#EEF2FF_100%)] p-6 shadow-[0_24px_80px_rgba(20,24,31,0.09)]">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#7C3AED]/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-8 h-40 w-40 rounded-full bg-[#0D9488]/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white/75 px-3 py-1.5 text-[12px] font-semibold text-brand shadow-sm backdrop-blur">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                Live clinic overview
              </span>
              <h2 className="mt-4 max-w-2xl text-[28px] font-bold leading-tight tracking-[-0.03em] text-ink md:text-[34px]">
                Command center for patient flow, staff capacity, and care momentum.
              </h2>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate">
                Track today&apos;s queue, active clinical coverage, and patient growth in one polished operating view.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {adminSignals.map((signal, index) => {
                const SignalIcon = signal.icon

                return (
                  <div
                    className="animate-fade-up rounded-[20px] border border-white/75 bg-white/80 p-4 shadow-[0_12px_34px_rgba(20,24,31,0.06)] backdrop-blur"
                    key={signal.label}
                    style={stagger(index, 0.05)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
                          {signal.label}
                        </p>
                        <p className="mt-2 text-[22px] font-bold leading-none text-ink">
                          {isLoading ? '-' : signal.value}
                        </p>
                        <p className="mt-2 text-[12px] font-medium text-slate">
                          {isLoading ? 'Syncing live data' : signal.context}
                        </p>
                      </div>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${signal.tone}`}>
                        <SignalIcon aria-hidden="true" className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(160deg,#4338CA_0%,#7C3AED_52%,#6D28D9_100%)] p-5 text-white shadow-[0_22px_60px_rgba(67,56,202,0.28)]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-white/70">Operations score</p>
                <p className="mt-3 text-[46px] font-bold leading-none tracking-[-0.04em]">
                  {isLoading ? '--' : operationsScore}
                </p>
                <p className="mt-2 text-[13px] text-white/70">Weighted from completion, doctors, and staff coverage.</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur">
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                Today
              </span>
            </div>

            <div className="relative mt-8 h-[92px]">
              <DashboardMiniSparkline
                areaClassName="fill-white/10"
                className="analytics-wave absolute inset-0 h-full w-full overflow-visible"
                lineClassName="stroke-white/85"
                values={adminHeroSparkline}
              />
              <div className="absolute bottom-0 left-0 right-0 flex justify-between font-mono text-[11px] text-white/60">
                {adminHeroSparkLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
                  Completed
                </p>
                <p className="mt-1 text-[22px] font-bold">{isLoading ? '-' : `${completionRate}%`}</p>
              </div>
              <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
                  New patients
                </p>
                <p className="mt-1 text-[22px] font-bold">{isLoading ? '-' : joinedThisMonthCount}</p>
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
                      <Avatar name={getDoctorName(doctor)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-ink">
                          {getDoctorName(doctor)}
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
        <DashboardPanel
          bodyClassName="p-6"
          headerContent={
            <div className="inline-flex rounded-full bg-mist p-1">
              {APPOINTMENT_PERIODS.map(([period, label]) => (
                <button
                  className={[
                    'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all',
                    appointmentPeriod === period
                      ? 'bg-canvas text-brand shadow-sm'
                      : 'text-slate hover:text-ink',
                  ].join(' ')}
                  key={period}
                  onClick={() => setAppointmentPeriod(period)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          }
          title="Appointment Trend"
        >
          {isLoading ? (
            <div className="h-[260px] rounded-control bg-mist p-4">
              <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]" ref={chartRef}>
              <div>
                <div className="h-[288px]">
                  <ResponsiveContainer height="100%" width="100%">
                    <ComposedChart data={chartData} margin={{ bottom: 0, left: -18, right: 12, top: 8 }}>
                    <defs>
                      <linearGradient id="trendScheduledGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#38BDF8" />
                        <stop offset="100%" stopColor="#0284C7" />
                      </linearGradient>
                      <linearGradient id="trendInProgressGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#FBBF24" />
                        <stop offset="100%" stopColor="#D97706" />
                      </linearGradient>
                      <linearGradient id="trendCompletedGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#34D399" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                      <linearGradient id="trendCancelledGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#FB7185" />
                        <stop offset="100%" stopColor="#DC2626" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      fontFamily="Outfit, sans-serif"
                      fontSize={11}
                      interval={appointmentPeriod === 'month' ? 2 : 0}
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
                    <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#EEF2FF66' }} />
                    <Bar
                      dataKey="scheduled"
                      fill="url(#trendScheduledGradient)"
                      name="Scheduled"
                      radius={[8, 8, 4, 4]}
                      stackId="flow"
                    />
                    <Bar
                      dataKey="inProgress"
                      fill="url(#trendInProgressGradient)"
                      name="In Progress"
                      radius={[8, 8, 4, 4]}
                      stackId="flow"
                    />
                    <Bar
                      dataKey="completed"
                      fill="url(#trendCompletedGradient)"
                      name="Completed"
                      radius={[8, 8, 4, 4]}
                      stackId="flow"
                    />
                    <Bar
                      dataKey="cancelled"
                      fill="url(#trendCancelledGradient)"
                      name="Cancelled"
                      radius={[8, 8, 4, 4]}
                      stackId="flow"
                    />
                    <Line
                      dataKey="rollingAverage"
                      dot={false}
                      name="7-day average"
                      stroke="#10B981"
                      strokeWidth={3}
                      type="monotone"
                    />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {APPOINTMENT_FLOW_KEYS.map(([key, label]) => (
                    <span
                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-slate shadow-sm"
                      key={key}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            key === 'scheduled'
                              ? STATUS_COLORS.scheduled
                              : key === 'inProgress'
                                ? STATUS_COLORS.in_progress
                                : key === 'completed'
                                  ? STATUS_COLORS.completed
                                  : STATUS_COLORS.cancelled,
                        }}
                      />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <aside className="flex flex-col justify-between rounded-[22px] border border-hairline/80 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] p-5">
                <div className="text-center">
                  <div
                    className="mx-auto flex h-36 w-36 items-center justify-center rounded-full p-3 shadow-[inset_0_0_0_1px_rgba(228,232,235,0.9)]"
                    style={{
                      background: `conic-gradient(#7C3AED ${completionRate * 3.6}deg, #EDE9FE 0deg)`,
                    }}
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white shadow-inner">
                      <Activity aria-hidden="true" className="mb-1 h-5 w-5 text-brand" />
                      <span className="font-mono text-[26px] font-bold text-ink">
                        {completionRate}%
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate">
                        Complete
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-brand-light px-4 py-3">
                    <span className="text-[12px] font-semibold text-brand">Open queue</span>
                    <span className="font-mono text-[14px] font-bold text-brand">{todayOpenCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-[#ECFDF5] px-4 py-3">
                    <span className="text-[12px] font-semibold text-[#059669]">Completed today</span>
                    <span className="font-mono text-[14px] font-bold text-[#059669]">{todayCompletedCount}</span>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </DashboardPanel>
      ) : null}

      {appointmentsEnabled || doctorsEnabled || patientsEnabled ? (
        <section className="grid gap-5 xl:grid-cols-3">
          {appointmentsEnabled ? (
            <DashboardPanel bodyClassName="p-0" title="Appointment Status Mix">
              {isLoading ? (
                <div className="m-5 h-[300px] rounded-[24px] bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : appointmentStatusData.length === 0 ? (
                <DashboardEmptyState title="No appointment status data yet" />
              ) : (
                <div className="analytics-surface overflow-hidden p-5">
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate">
                        Live status distribution
                      </p>
                      <p className="mt-2 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink">
                        {appointmentStatusTotal}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-slate">
                        appointment records in view
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-light px-3 py-1.5 font-mono text-[11px] font-bold text-brand">
                      {completionRate}% complete
                    </span>
                  </div>

                  <div className="relative mt-5 h-[224px]">
                    <ResponsiveContainer height="100%" width="100%">
                      <BarChart data={appointmentStatusData} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                        <defs>
                          <linearGradient id="statusGradient-scheduled" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#38BDF8" />
                            <stop offset="100%" stopColor="#0284C7" />
                          </linearGradient>
                          <linearGradient id="statusGradient-in_progress" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#F59E0B" />
                            <stop offset="100%" stopColor="#D97706" />
                          </linearGradient>
                          <linearGradient id="statusGradient-completed" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#34D399" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                          <linearGradient id="statusGradient-cancelled" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#FB7185" />
                            <stop offset="100%" stopColor="#DC2626" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 7" vertical={false} />
                        <XAxis
                          axisLine={false}
                          dataKey="label"
                          fontFamily="JetBrains Mono, monospace"
                          fontSize={10}
                          tick={{ fill: '#5B6472' }}
                          tickLine={false}
                          tickMargin={12}
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
                        <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#FFFFFF66' }} />
                        <Bar
                          background={{ fill: '#EEF2F7', radius: 10 }}
                          barSize={44}
                          dataKey="count"
                          name="Appointments"
                          radius={[12, 12, 8, 8]}
                        >
                          {appointmentStatusData.map((item) => (
                            <Cell fill={`url(#statusGradient-${item.status})`} key={item.status} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="relative mt-4 space-y-2">
                    {appointmentStatusData.map((item) => (
                      <div className="flex items-center gap-3" key={item.status}>
                        <span className="w-24 truncate text-[12px] font-semibold text-slate">
                          {item.label}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: item.color,
                              width: `${Math.round((item.count / appointmentStatusPeak) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-[12px] font-bold text-ink">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DashboardPanel>
          ) : null}

          {doctorsEnabled ? (
            <DashboardPanel bodyClassName="p-0" title="Doctor Workload Today">
              {isLoading ? (
                <div className="m-5 h-[300px] rounded-[24px] bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : doctorWorkloadData.length === 0 ? (
                <DashboardEmptyState title="No workload data yet" />
              ) : (
                <div className="analytics-surface overflow-hidden p-5">
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate">
                        Clinical load today
                      </p>
                      <p className="mt-2 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink">
                        {workloadTotal}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-slate">
                        cases across active doctors
                      </p>
                    </div>
                    <span className="rounded-full bg-[#EEF2FF] px-3 py-1.5 font-mono text-[11px] font-bold text-brand">
                      Peak {busiestDoctor?.label || 'Doctor'}
                    </span>
                  </div>

                  <div className="relative mt-5 h-[224px]">
                    <ResponsiveContainer height="100%" width="100%">
                      <BarChart data={doctorWorkloadData} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                        <defs>
                          <linearGradient id="workloadGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#7C3AED" />
                            <stop offset="56%" stopColor="#4338CA" />
                            <stop offset="100%" stopColor="#312E81" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 7" vertical={false} />
                        <XAxis
                          axisLine={false}
                          dataKey="label"
                          fontFamily="JetBrains Mono, monospace"
                          fontSize={10}
                          tick={{ fill: '#5B6472' }}
                          tickLine={false}
                          tickMargin={12}
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
                        <Bar
                          background={{ fill: '#EEF2F7', radius: 10 }}
                          barSize={42}
                          dataKey="cases"
                          fill="url(#workloadGradient)"
                          name="Cases"
                          radius={[12, 12, 8, 8]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="relative mt-4 grid gap-2">
                    {doctorWorkloadData.slice(0, 3).map((doctor, index) => (
                      <div className="flex items-center gap-3" key={doctor.label}>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light font-mono text-[11px] font-bold text-brand">
                          {index + 1}
                        </span>
                        <span className="w-20 truncate text-[12px] font-semibold text-slate">
                          {doctor.label}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand to-[#7C3AED]"
                            style={{ width: `${Math.round((doctor.cases / workloadPeak) * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-[12px] font-bold text-ink">
                          {doctor.cases}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DashboardPanel>
          ) : null}

          {patientsEnabled ? (
            <DashboardPanel bodyClassName="p-0" title="Patients by Gender">
              {isLoading ? (
                <div className="m-5 h-[300px] rounded-[24px] bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : patientGenderData.length === 0 ? (
                <DashboardEmptyState title="No patient gender data yet" />
              ) : (
                <div className="analytics-surface overflow-hidden p-5">
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate">
                        Patient segmentation
                      </p>
                      <p className="mt-2 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink">
                        {totalGenderPatients}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-slate">
                        total patient profiles
                      </p>
                    </div>
                    <span className="rounded-full bg-[#CCFBF1] px-3 py-1.5 font-mono text-[11px] font-bold text-[#0F766E]">
                      Top {leadingGender?.label || 'Segment'}
                    </span>
                  </div>

                  <div className="relative mt-2 h-[234px]">
                    <div className="pointer-events-none absolute inset-x-12 top-10 h-32 rounded-full bg-brand/10 blur-3xl" />
                    <ResponsiveContainer height="100%" width="100%">
                      <PieChart>
                        <defs>
                          <linearGradient id="genderGradient-Female" x1="0" x2="1" y1="0" y2="1">
                            <stop offset="0%" stopColor="#2DD4BF" />
                            <stop offset="100%" stopColor="#0D9488" />
                          </linearGradient>
                          <linearGradient id="genderGradient-Male" x1="0" x2="1" y1="0" y2="1">
                            <stop offset="0%" stopColor="#7C3AED" />
                            <stop offset="100%" stopColor="#4338CA" />
                          </linearGradient>
                          <linearGradient id="genderGradient-Other" x1="0" x2="1" y1="0" y2="1">
                            <stop offset="0%" stopColor="#FBBF24" />
                            <stop offset="100%" stopColor="#F59E0B" />
                          </linearGradient>
                        </defs>
                        <Tooltip content={<DashboardChartTooltip />} />
                        <Pie
                          data={patientGenderData}
                          dataKey="count"
                          innerRadius={72}
                          label={false}
                          labelLine={false}
                          nameKey="label"
                          outerRadius={104}
                          paddingAngle={4}
                          startAngle={90}
                          endAngle={-270}
                        >
                          {patientGenderData.map((item) => (
                            <Cell
                              fill={`url(#genderGradient-${item.label})`}
                              key={item.label}
                              stroke="#FFFFFF"
                              strokeWidth={4}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-[30px] font-bold text-ink">
                        {totalGenderPatients}
                      </span>
                      <span className="text-[12px] font-semibold text-slate">Patients</span>
                    </div>
                  </div>

                  <div className="relative mt-2 space-y-2">
                    {patientGenderData.map((item) => (
                      <div
                        className="grid grid-cols-[78px_minmax(0,1fr)_42px] items-center gap-3"
                        key={item.label}
                      >
                        <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.label}
                        </span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: item.color,
                              width: `${Math.round((item.count / totalGenderPatients) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-right font-mono text-[12px] font-bold text-ink">
                          {Math.round((item.count / totalGenderPatients) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
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
