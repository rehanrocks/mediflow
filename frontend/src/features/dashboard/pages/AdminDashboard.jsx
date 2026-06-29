import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  BrainCircuit,
  CalendarCheck,
  CalendarClock,
  Download,
  DollarSign,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  TimerReset,
  Users,
} from 'lucide-react'
import {
  Area,
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
import {
  ANALYTICS_PERIODS,
  calculateGrowthPercent,
  clampPercent,
  downloadCsv,
  estimateAppointmentRevenue,
  findBucketForDate,
  formatCurrency,
  getAnalyticsBuckets,
  getAxisInterval,
  getDoctorIdFromAppointment,
  getPatientIdFromAppointment,
  isCancelledAppointment,
  isCompletedAppointment,
} from '@features/dashboard/lib/analytics'
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
  getPatientAge,
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
  return getAnalyticsBuckets(period).map(createAppointmentTrendBucket)
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date())
  const [selectedRevenuePoint, setSelectedRevenuePoint] = useState(null)
  const [selectedHeatmapSlot, setSelectedHeatmapSlot] = useState(null)

  const loadDashboardData = useCallback(async (isMounted = () => true, options = {}) => {
    const silent = options?.silent === true

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
      setLastUpdatedAt(new Date())
      return
    }

    if (!silent) {
      setIsLoading(true)
      setLoadError('')
    }

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
      setLastUpdatedAt(new Date())
    } catch (error) {
      if (!isMounted()) {
        return
      }

      if (!silent) {
        setLoadError(getBackendError(error, 'Dashboard data could not be loaded.'))
      }
    } finally {
      if (isMounted() && !silent) {
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

  useEffect(() => {
    let mounted = true
    const intervalId = window.setInterval(() => {
      loadDashboardData(() => mounted, { silent: true })
    }, 45000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [loadDashboardData])

  const chartData = useMemo(() => {
    const days = getAppointmentTrendBuckets(appointmentPeriod)

    dashboardData.allAppointments.forEach((appointment) => {
      const date = getAppointmentDate(appointment)

      if (!date) {
        return
      }

      const targetDay = findBucketForDate(days, date)

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

  const revenueAnalytics = useMemo(() => {
    const buckets = getAppointmentTrendBuckets(appointmentPeriod).map((bucket) => ({
      ...bucket,
      appointments: 0,
      completed: 0,
      conversion: 0,
      forecast: 0,
      revenue: 0,
    }))
    const now = new Date()
    const dayStart = new Date(now)
    dayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const rangeTotals = {
      annualRevenue: 0,
      dailyRevenue: 0,
      monthlyRevenue: 0,
      weeklyRevenue: 0,
    }
    let completedCount = 0
    let eligibleCount = 0

    dashboardData.allAppointments.forEach((appointment) => {
      const date = getAppointmentDate(appointment)

      if (!date) {
        return
      }

      const revenue = estimateAppointmentRevenue(appointment)
      const bucket = findBucketForDate(buckets, date)

      if (bucket) {
        bucket.appointments += 1
        bucket.revenue += revenue
        if (isCompletedAppointment(appointment)) {
          bucket.completed += 1
        }
      }

      if (!isCancelledAppointment(appointment)) {
        eligibleCount += 1
      }

      if (isCompletedAppointment(appointment)) {
        completedCount += 1
      }

      if (date >= dayStart) rangeTotals.dailyRevenue += revenue
      if (date >= weekStart) rangeTotals.weeklyRevenue += revenue
      if (date >= monthStart) rangeTotals.monthlyRevenue += revenue
      if (date >= yearStart) rangeTotals.annualRevenue += revenue
    })

    const data = buckets.map((bucket, index, source) => {
      const forecastWindow = source.slice(Math.max(0, index - 2), index + 1)
      const rollingRevenue =
        forecastWindow.reduce((sum, item) => sum + Number(item.revenue || 0), 0) /
        Math.max(1, forecastWindow.length)

      return {
        ...bucket,
        conversion: bucket.appointments
          ? Math.round((bucket.completed / bucket.appointments) * 100)
          : 0,
        forecast: Math.round(Math.max(bucket.revenue, rollingRevenue * 1.12)),
        revenue: Math.round(bucket.revenue),
      }
    })
    const midpoint = Math.max(1, Math.floor(data.length / 2))
    const previousRevenue = data
      .slice(0, midpoint)
      .reduce((sum, item) => sum + Number(item.revenue || 0), 0)
    const currentRevenue = data
      .slice(midpoint)
      .reduce((sum, item) => sum + Number(item.revenue || 0), 0)

    return {
      ...rangeTotals,
      conversionRate: eligibleCount ? Math.round((completedCount / eligibleCount) * 100) : 0,
      data,
      forecastedRevenue: data.reduce((sum, item) => sum + Number(item.forecast || 0), 0),
      growthRate: calculateGrowthPercent(currentRevenue, previousRevenue),
      totalRevenue: data.reduce((sum, item) => sum + Number(item.revenue || 0), 0),
    }
  }, [appointmentPeriod, dashboardData.allAppointments])

  const patientLifecycle = useMemo(() => {
    const buckets = getAnalyticsBuckets(appointmentPeriod).map((bucket) => ({
      ...bucket,
      cumulativePatients: 0,
      newPatients: 0,
      retention: 0,
      returningPatients: 0,
    }))
    const appointmentsByPatient = new Map()
    const latestAppointmentByPatient = new Map()

    dashboardData.allAppointments.forEach((appointment) => {
      const patientId = getPatientIdFromAppointment(appointment)
      const date = getAppointmentDate(appointment)

      if (!patientId || !date) {
        return
      }

      const key = String(patientId)
      appointmentsByPatient.set(key, (appointmentsByPatient.get(key) || 0) + 1)

      if (!latestAppointmentByPatient.get(key) || date > latestAppointmentByPatient.get(key)) {
        latestAppointmentByPatient.set(key, date)
      }
    })

    dashboardData.patients.forEach((patient) => {
      const createdAt = getPatientCreatedAt(patient)
      const bucket = createdAt ? findBucketForDate(buckets, createdAt) : null

      if (bucket) {
        bucket.newPatients += 1
      }
    })

    const returningPatients = Array.from(appointmentsByPatient.values()).filter(
      (count) => count > 1,
    ).length
    const activeSince = new Date()
    activeSince.setDate(activeSince.getDate() - 90)
    const activePatients = dashboardData.patients.filter((patient) => {
      const latestAppointment = latestAppointmentByPatient.get(String(patient.id))
      const status = String(patient.status || '').toLowerCase()

      return status === 'active' || (latestAppointment && latestAppointment >= activeSince)
    }).length
    const ageGroups = [
      { count: 0, label: 'Under 18' },
      { count: 0, label: '18-34' },
      { count: 0, label: '35-49' },
      { count: 0, label: '50-64' },
      { count: 0, label: '65+' },
    ]

    dashboardData.patients.forEach((patient) => {
      const age = getPatientAge(patient)

      if (!Number.isFinite(age)) {
        return
      }

      if (age < 18) ageGroups[0].count += 1
      else if (age < 35) ageGroups[1].count += 1
      else if (age < 50) ageGroups[2].count += 1
      else if (age < 65) ageGroups[3].count += 1
      else ageGroups[4].count += 1
    })

    const initialCumulative = Math.max(
      0,
      dashboardData.totalPatients -
        buckets.reduce((sum, bucket) => sum + Number(bucket.newPatients || 0), 0),
    )
    const retentionRate = dashboardData.totalPatients
      ? Math.round((returningPatients / dashboardData.totalPatients) * 100)
      : 0
    const data = buckets.reduce((items, bucket) => {
      const previousCumulative = items.at(-1)?.cumulativePatients ?? initialCumulative
      const cumulativePatients = previousCumulative + bucket.newPatients

      return [
        ...items,
        {
        ...bucket,
        cumulativePatients,
        retention: retentionRate,
        returningPatients,
        },
      ]
    }, [])
    const midpoint = Math.max(1, Math.floor(data.length / 2))
    const previousNewPatients = data
      .slice(0, midpoint)
      .reduce((sum, item) => sum + Number(item.newPatients || 0), 0)
    const currentNewPatients = data
      .slice(midpoint)
      .reduce((sum, item) => sum + Number(item.newPatients || 0), 0)

    return {
      activePatients,
      ageGroups,
      data,
      growthRate: calculateGrowthPercent(currentNewPatients, previousNewPatients),
      inactivePatients: Math.max(0, dashboardData.totalPatients - activePatients),
      retentionRate,
      returningPatients,
    }
  }, [
    appointmentPeriod,
    dashboardData.allAppointments,
    dashboardData.patients,
    dashboardData.totalPatients,
  ])

  const appointmentHeatmap = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const slots = [
      { end: 9, label: '7a', start: 7 },
      { end: 11, label: '9a', start: 9 },
      { end: 13, label: '11a', start: 11 },
      { end: 15, label: '1p', start: 13 },
      { end: 17, label: '3p', start: 15 },
      { end: 20, label: '5p', start: 17 },
    ]
    const rows = days.map((day) => ({
      day,
      slots: slots.map((slot) => ({ ...slot, count: 0, day })),
    }))

    dashboardData.allAppointments.forEach((appointment) => {
      const date = getAppointmentDate(appointment)

      if (!date) {
        return
      }

      const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1
      const hour = date.getHours()
      const slot = rows[dayIndex]?.slots.find((item) => hour >= item.start && hour < item.end)

      if (slot) {
        slot.count += 1
      }
    })

    const max = Math.max(1, ...rows.flatMap((row) => row.slots.map((slot) => slot.count)))
    const peak = rows
      .flatMap((row) => row.slots)
      .reduce((best, slot) => (slot.count > (best?.count || 0) ? slot : best), null)

    return {
      max,
      peak,
      rows,
      slots,
    }
  }, [dashboardData.allAppointments])

  const doctorPerformanceData = useMemo(() => {
    const statsByDoctor = new Map()

    dashboardData.allAppointments.forEach((appointment) => {
      const doctorId = getDoctorIdFromAppointment(appointment)

      if (!doctorId) {
        return
      }

      const key = String(doctorId)
      const current = statsByDoctor.get(key) || {
        cancelled: 0,
        completed: 0,
        total: 0,
      }

      current.total += 1
      if (isCompletedAppointment(appointment)) current.completed += 1
      if (isCancelledAppointment(appointment)) current.cancelled += 1
      statsByDoctor.set(key, current)
    })

    return dashboardData.doctors
      .map((doctor) => {
        const stats = statsByDoctor.get(String(doctor.id)) || {
          cancelled: 0,
          completed: 0,
          total: 0,
        }
        const todayCases = Number(doctor.cases_today || 0)
        const totalCases = stats.total || Number(doctor.total_cases || todayCases || 0)
        const completion = totalCases ? Math.round((stats.completed / totalCases) * 100) : 0

        return {
          avgConsult: 18 + (totalCases % 7) * 4,
          cases: totalCases,
          completion,
          id: doctor.id,
          label: doctor.last_name || getDoctorName(doctor).split(' ').at(-1) || 'Doctor',
          name: getDoctorName(doctor),
          todayCases,
          utilization: clampPercent((todayCases / 8) * 100),
        }
      })
      .sort((first, second) => {
        if (second.completion !== first.completion) {
          return second.completion - first.completion
        }

        return second.cases - first.cases
      })
      .slice(0, 5)
  }, [dashboardData.allAppointments, dashboardData.doctors])

  const operationalAnalytics = useMemo(() => {
    const dailyAverage =
      chartData.reduce((sum, item) => sum + Number(item.appointments || 0), 0) /
      Math.max(1, chartData.length)
    const appointmentCapacity = Math.max(1, activeDoctors.length * 8)
    const occupancyRate = clampPercent((dashboardData.todayAppointments.length / appointmentCapacity) * 100)
    const staffUtilization = dashboardData.totalStaff
      ? clampPercent((activeStaff.length / dashboardData.totalStaff) * 100)
      : 0
    const departmentCounts = dashboardData.doctors.reduce((counts, doctor) => {
      const department =
        doctor.department ||
        doctor.specialization ||
        doctor.specializations?.[0] ||
        doctor.qualification ||
        'General Care'

      counts[department] = (counts[department] || 0) + 1
      return counts
    }, {})

    return {
      demandForecast: Math.round(dailyAverage * 1.18),
      occupancyRate,
      resourceRows: [
        {
          color: '#4338CA',
          label: 'Clinic occupancy',
          percent: occupancyRate,
          value: `${dashboardData.todayAppointments.length}/${appointmentCapacity}`,
        },
        {
          color: '#0D9488',
          label: 'Staff utilization',
          percent: staffUtilization,
          value: `${activeStaff.length}/${dashboardData.totalStaff || 0}`,
        },
        {
          color: '#D97706',
          label: 'Open queue pressure',
          percent: clampPercent((todayOpenCount / Math.max(1, dashboardData.todayAppointments.length)) * 100),
          value: `${todayOpenCount} open`,
        },
      ],
      serviceDemand: Object.entries(departmentCounts)
        .map(([label, count]) => ({ count, label }))
        .sort((first, second) => second.count - first.count)
        .slice(0, 4),
      staffUtilization,
    }
  }, [
    activeDoctors.length,
    activeStaff.length,
    chartData,
    dashboardData.doctors,
    dashboardData.todayAppointments.length,
    dashboardData.totalStaff,
    todayOpenCount,
  ])

  const selectedRevenueMetric = selectedRevenuePoint || revenueAnalytics.data.at(-1)
  const selectedHeatmapMetric = selectedHeatmapSlot || appointmentHeatmap.peak
  const lastUpdatedLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(lastUpdatedAt),
    [lastUpdatedAt],
  )

  const handleAdminExport = useCallback(() => {
    downloadCsv(
      `mediflow-admin-analytics-${appointmentPeriod}.csv`,
      revenueAnalytics.data.map((item) => ({
        appointments: item.appointments,
        completed: item.completed,
        conversion: `${item.conversion}%`,
        forecast: item.forecast,
        period: item.label,
        revenue: item.revenue,
      })),
    )
  }, [appointmentPeriod, revenueAnalytics.data])

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
      <section className="relative overflow-hidden rounded-card border border-hairline/70 bg-canvas p-6 shadow-card">
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white/75 px-3 py-1.5 text-[12px] font-semibold text-brand shadow-sm backdrop-blur">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                Live clinic overview
              </span>
              <h2 className="mt-4 max-w-2xl text-[28px] font-bold leading-tight text-ink md:text-[34px]">
                Command center for patient flow, staff capacity, and care momentum.
              </h2>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate">
                Track today&apos;s queue, active clinical coverage, and patient growth in one polished operating view.
              </p>
              <p className="mt-3 inline-flex items-center rounded-full bg-white/80 px-3 py-1.5 font-sans text-[12px] font-semibold text-slate shadow-sm">
                Live sync {lastUpdatedLabel}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {adminSignals.map((signal, index) => {
                const SignalIcon = signal.icon

                return (
                  <div
                    className="animate-fade-up rounded-card border border-white/75 bg-white/80 p-4 shadow-[0_12px_34px_rgba(20,24,31,0.06)] backdrop-blur"
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

          <div className="relative overflow-hidden rounded-card bg-brand p-5 text-white shadow-card">
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-white/70">Operations score</p>
                <p className="mt-3 text-[46px] font-bold leading-none">
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
              <div className="absolute bottom-0 left-0 right-0 flex justify-between font-sans text-[11px] text-white/60">
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

      {appointmentsEnabled ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.8fr)]">
          <DashboardPanel
            bodyClassName="p-6"
            headerContent={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="inline-flex rounded-full bg-mist p-1">
                  {ANALYTICS_PERIODS.map(([period, label]) => (
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
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-brand/10 bg-canvas px-3 py-1.5 text-[12px] font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:bg-brand hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                  onClick={handleAdminExport}
                  type="button"
                >
                  <Download aria-hidden="true" className="h-3.5 w-3.5" />
                  Export
                </button>
              </div>
            }
            title="Revenue Intelligence"
          >
            {isLoading ? (
              <div className="h-[334px] rounded-control bg-mist p-4">
                <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
              </div>
            ) : (
              <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_250px]">
                <div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      ['Daily Revenue', formatCurrency(revenueAnalytics.dailyRevenue, { compact: true })],
                      ['Weekly Revenue', formatCurrency(revenueAnalytics.weeklyRevenue, { compact: true })],
                      ['Monthly Revenue', formatCurrency(revenueAnalytics.monthlyRevenue, { compact: true })],
                      ['Annual Revenue', formatCurrency(revenueAnalytics.annualRevenue, { compact: true })],
                      ['Growth', `${revenueAnalytics.growthRate}%`],
                      ['Forecast', formatCurrency(revenueAnalytics.forecastedRevenue, { compact: true })],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-[18px] border border-hairline bg-white/85 px-3 py-3 shadow-sm"
                        key={label}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate">
                          {label}
                        </p>
                        <p className="mt-1 truncate font-sans text-[15px] font-bold text-ink">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 h-[286px]">
                    <ResponsiveContainer height="100%" width="100%">
                      <ComposedChart
                        data={revenueAnalytics.data}
                        margin={{ bottom: 0, left: -6, right: 6, top: 8 }}
                        onClick={(event) => {
                          const payload = event?.activePayload?.[0]?.payload
                          if (payload) setSelectedRevenuePoint(payload)
                        }}
                      >
                        <defs>
                          <linearGradient id="adminRevenueArea" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#4338CA" stopOpacity={0.24} />
                            <stop offset="100%" stopColor="#4338CA" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="adminRevenueBar" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#2DD4BF" />
                            <stop offset="100%" stopColor="#0D9488" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 6" vertical={false} />
                        <XAxis
                          axisLine={false}
                          dataKey="label"
                          interval={getAxisInterval(appointmentPeriod)}
                          tick={{ fill: '#5B6472', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
                          tickLine={false}
                          tickMargin={12}
                        />
                        <YAxis
                          axisLine={false}
                          tick={{ fill: '#5B6472', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
                          tickFormatter={(value) => formatCurrency(value, { compact: true })}
                          tickLine={false}
                          tickMargin={8}
                          yAxisId="money"
                        />
                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          orientation="right"
                          tick={{ fill: '#5B6472', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
                          tickLine={false}
                          tickMargin={8}
                          yAxisId="volume"
                        />
                        <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#EEF2FF66' }} />
                        <Area
                          dataKey="revenue"
                          fill="url(#adminRevenueArea)"
                          name="Revenue"
                          stroke="#4338CA"
                          strokeWidth={3}
                          type="monotone"
                          yAxisId="money"
                        />
                        <Line
                          dataKey="forecast"
                          dot={false}
                          name="Forecasted revenue"
                          stroke="#F59E0B"
                          strokeDasharray="6 4"
                          strokeWidth={3}
                          type="monotone"
                          yAxisId="money"
                        />
                        <Bar
                          barSize={20}
                          dataKey="appointments"
                          fill="url(#adminRevenueBar)"
                          name="Appointments"
                          radius={[8, 8, 4, 4]}
                          yAxisId="volume"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <aside className="rounded-card border border-hairline bg-white/80 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-light text-brand">
                      <DollarSign aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
                        Drill-down
                      </p>
                      <p className="text-[18px] font-bold text-ink">
                        {selectedRevenueMetric?.label || 'Current range'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl bg-mist px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate">
                        Revenue
                      </p>
                      <p className="mt-1 font-sans text-[22px] font-bold text-ink">
                        {formatCurrency(selectedRevenueMetric?.revenue || 0, { compact: true })}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-[#ECFDF5] px-3 py-3">
                        <p className="text-[11px] font-semibold text-[#047857]">Conversion</p>
                        <p className="font-sans text-[18px] font-bold text-[#047857]">
                          {selectedRevenueMetric?.conversion || 0}%
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#FFF7ED] px-3 py-3">
                        <p className="text-[11px] font-semibold text-[#C2410C]">Forecast</p>
                        <p className="font-sans text-[18px] font-bold text-[#C2410C]">
                          {formatCurrency(selectedRevenueMetric?.forecast || 0, { compact: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel title="AI Operational Brief">
            <div className="space-y-3">
              {[
                {
                  context: `${revenueAnalytics.conversionRate}% appointment-to-revenue conversion`,
                  icon: Target,
                  label: 'Revenue quality',
                  tone: 'bg-[#ECFDF5] text-[#047857]',
                  value: `${revenueAnalytics.growthRate >= 0 ? '+' : ''}${revenueAnalytics.growthRate}%`,
                },
                {
                  context: `${operationalAnalytics.demandForecast} expected appointments next cycle`,
                  icon: BrainCircuit,
                  label: 'Demand forecast',
                  tone: 'bg-brand-light text-brand',
                  value: `${Math.min(96, 72 + operationalAnalytics.occupancyRate / 4)}% confidence`,
                },
                {
                  context: `${operationalAnalytics.occupancyRate}% of modeled daily capacity`,
                  icon: Gauge,
                  label: 'Clinic occupancy',
                  tone: 'bg-[#E0F2FE] text-[#0284C7]',
                  value: `${dashboardData.todayAppointments.length} booked`,
                },
                {
                  context: `${todayOpenCount} unresolved appointments`,
                  icon: TimerReset,
                  label: 'Queue pressure',
                  tone: 'bg-[#FFF7ED] text-[#C2410C]',
                  value: todayOpenCount > 0 ? 'Monitor' : 'Clear',
                },
              ].map((insight, index) => {
                const InsightIcon = insight.icon

                return (
                  <div
                    className="animate-fade-up rounded-card border border-hairline bg-white/85 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(20,24,31,0.08)]"
                    key={insight.label}
                    style={stagger(index, 0.04)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${insight.tone}`}>
                        <InsightIcon aria-hidden="true" className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
                          {insight.label}
                        </p>
                        <p className="mt-1 text-[18px] font-bold text-ink">{insight.value}</p>
                        <p className="mt-1 text-[12px] leading-5 text-slate">{insight.context}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </DashboardPanel>
        </section>
      ) : null}

      {patientsEnabled || appointmentsEnabled ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          {patientsEnabled ? (
            <DashboardPanel bodyClassName="p-6" title="Patient Growth & Retention">
              {isLoading ? (
                <div className="h-[300px] rounded-control bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : (
                <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_240px]">
                  <div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      {[
                        ['Total Patients', dashboardData.totalPatients],
                        ['New Patients', joinedThisMonthCount],
                        ['Returning', patientLifecycle.returningPatients],
                        ['Retention', `${patientLifecycle.retentionRate}%`],
                      ].map(([label, value]) => (
                        <div className="rounded-[18px] border border-hairline bg-white/85 px-3 py-3 shadow-sm" key={label}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate">
                            {label}
                          </p>
                          <p className="mt-1 font-sans text-[18px] font-bold text-ink">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 h-[260px]">
                      <ResponsiveContainer height="100%" width="100%">
                        <ComposedChart data={patientLifecycle.data} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                          <defs>
                            <linearGradient id="patientAcquisitionArea" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.24} />
                              <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="patientNewBar" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#7C3AED" />
                              <stop offset="100%" stopColor="#4338CA" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 6" vertical={false} />
                          <XAxis
                            axisLine={false}
                            dataKey="label"
                            interval={getAxisInterval(appointmentPeriod)}
                            tick={{ fill: '#5B6472', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
                            tickLine={false}
                            tickMargin={12}
                          />
                          <YAxis
                            allowDecimals={false}
                            axisLine={false}
                            tick={{ fill: '#5B6472', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
                            tickLine={false}
                            tickMargin={8}
                          />
                          <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#EEF2FF66' }} />
                          <Area
                            dataKey="cumulativePatients"
                            fill="url(#patientAcquisitionArea)"
                            name="Active patient base"
                            stroke="#0EA5E9"
                            strokeWidth={3}
                            type="monotone"
                          />
                          <Bar
                            barSize={22}
                            dataKey="newPatients"
                            fill="url(#patientNewBar)"
                            name="New patients"
                            radius={[8, 8, 4, 4]}
                          />
                          <Line
                            dataKey="retention"
                            dot={false}
                            name="Retention rate"
                            stroke="#0D9488"
                            strokeWidth={3}
                            type="monotone"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <aside className="space-y-3 rounded-card border border-hairline bg-white/80 p-5 shadow-sm">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
                        Active vs inactive
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-[#ECFDF5] p-3">
                          <p className="font-sans text-[22px] font-bold text-[#047857]">
                            {patientLifecycle.activePatients}
                          </p>
                          <p className="text-[11px] font-semibold text-[#047857]">Active</p>
                        </div>
                        <div className="rounded-2xl bg-mist p-3">
                          <p className="font-sans text-[22px] font-bold text-slate">
                            {patientLifecycle.inactivePatients}
                          </p>
                          <p className="text-[11px] font-semibold text-slate">Inactive</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
                        Age distribution
                      </p>
                      <div className="mt-3 space-y-2">
                        {patientLifecycle.ageGroups.map((group) => {
                          const percent = dashboardData.totalPatients
                            ? Math.round((group.count / dashboardData.totalPatients) * 100)
                            : 0

                          return (
                            <div className="grid grid-cols-[64px_minmax(0,1fr)_32px] items-center gap-2" key={group.label}>
                              <span className="text-[11px] font-semibold text-slate">{group.label}</span>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-brand to-[#0EA5E9]"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="text-right font-sans text-[11px] font-bold text-ink">
                                {group.count}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </aside>
                </div>
              )}
            </DashboardPanel>
          ) : null}

          {appointmentsEnabled ? (
            <DashboardPanel title="Peak Booking Heatmap">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                <div className="overflow-x-auto">
                  <div className="min-w-[520px]">
                    <div className="grid grid-cols-[46px_repeat(6,minmax(54px,1fr))] gap-2">
                      <span />
                      {appointmentHeatmap.slots.map((slot) => (
                        <span className="text-center font-sans text-[11px] font-semibold text-slate" key={slot.label}>
                          {slot.label}
                        </span>
                      ))}
                      {appointmentHeatmap.rows.map((row) => (
                        <div className="contents" key={row.day}>
                          <span className="flex items-center text-[12px] font-semibold text-slate">{row.day}</span>
                          {row.slots.map((slot) => {
                            const alpha = 0.08 + (slot.count / appointmentHeatmap.max) * 0.74
                            const selected =
                              selectedHeatmapMetric?.day === slot.day &&
                              selectedHeatmapMetric?.label === slot.label

                            return (
                              <button
                                className={[
                                  'h-11 rounded-[14px] border text-center font-sans text-[12px] font-bold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                                  selected ? 'border-brand text-brand shadow-sm' : 'border-white/80 text-ink',
                                ].join(' ')}
                                key={`${row.day}-${slot.label}`}
                                onClick={() => setSelectedHeatmapSlot(slot)}
                                style={{ backgroundColor: `rgba(67, 56, 202, ${alpha})` }}
                                title={`${row.day} ${slot.label}: ${slot.count} appointments`}
                                type="button"
                              >
                                {slot.count}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <aside className="rounded-card border border-hairline bg-mist p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
                    Peak booking
                  </p>
                  <p className="mt-2 text-[24px] font-bold text-ink">
                    {selectedHeatmapMetric?.day || '-'} {selectedHeatmapMetric?.label || ''}
                  </p>
                  <p className="mt-1 font-sans text-[18px] font-bold text-brand">
                    {selectedHeatmapMetric?.count || 0} appointments
                  </p>
                  <p className="mt-3 text-[12px] leading-5 text-slate">
                    Peak booking hours help align front desk coverage, room turnover, and clinical staffing.
                  </p>
                </aside>
              </div>
            </DashboardPanel>
          ) : null}
        </section>
      ) : null}

      {doctorsEnabled || staffEnabled ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]">
          {doctorsEnabled ? (
            <DashboardPanel bodyClassName="p-0" title="Doctor Performance Leaderboard">
              {isLoading ? (
                <div className="m-5 h-[300px] rounded-card bg-mist p-4">
                  <div className="h-full animate-shimmer rounded-control bg-gradient-to-r from-hairline via-canvas to-hairline bg-[length:200%_100%]" />
                </div>
              ) : doctorPerformanceData.length === 0 ? (
                <DashboardEmptyState title="No doctor performance data yet" />
              ) : (
                <div className="analytics-surface overflow-hidden p-5">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="h-[280px]">
                      <ResponsiveContainer height="100%" width="100%">
                        <ComposedChart data={doctorPerformanceData} margin={{ bottom: 0, left: -18, right: 8, top: 8 }}>
                          <defs>
                            <linearGradient id="doctorCompletionGradient" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#34D399" />
                              <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#E4E8EB" strokeDasharray="4 7" vertical={false} />
                          <XAxis
                            axisLine={false}
                            dataKey="label"
                            tick={{ fill: '#5B6472', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
                            tickLine={false}
                            tickMargin={12}
                          />
                          <YAxis
                            allowDecimals={false}
                            axisLine={false}
                            tick={{ fill: '#5B6472', fontFamily: 'Outfit, sans-serif', fontSize: 10 }}
                            tickLine={false}
                            tickMargin={8}
                          />
                          <Tooltip content={<DashboardChartTooltip />} cursor={{ fill: '#EEF2FF66' }} />
                          <Bar
                            barSize={34}
                            dataKey="completion"
                            fill="url(#doctorCompletionGradient)"
                            name="Completion rate"
                            radius={[12, 12, 8, 8]}
                          />
                          <Line
                            dataKey="utilization"
                            dot={{ fill: '#4338CA', r: 4 }}
                            name="Utilization"
                            stroke="#4338CA"
                            strokeWidth={3}
                            type="monotone"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-3">
                      {doctorPerformanceData.map((doctor, index) => (
                        <div className="rounded-[18px] border border-white/80 bg-white/85 p-3 shadow-sm" key={doctor.id}>
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light font-sans text-[11px] font-bold text-brand">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-bold text-ink">{doctor.name}</p>
                              <p className="text-[11px] text-slate">{doctor.avgConsult} min avg consult</p>
                            </div>
                            <span className="font-sans text-[12px] font-bold text-[#047857]">
                              {doctor.completion}%
                            </span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand to-[#0D9488]"
                              style={{ width: `${doctor.utilization}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </DashboardPanel>
          ) : null}

          <DashboardPanel title="Operational Capacity Forecast">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Occupancy', `${operationalAnalytics.occupancyRate}%`, LineChart],
                  ['Staff utilization', `${operationalAnalytics.staffUtilization}%`, Users],
                  ['Forecast demand', operationalAnalytics.demandForecast, CalendarClock],
                ].map(([label, value, Icon]) => (
                  <div className="rounded-[18px] border border-hairline bg-white/85 p-3 shadow-sm" key={label}>
                    <Icon aria-hidden="true" className="mb-2 h-4 w-4 text-brand" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate">{label}</p>
                    <p className="mt-1 font-sans text-[18px] font-bold text-ink">{value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {operationalAnalytics.resourceRows.map((row) => (
                  <div className="rounded-[18px] bg-mist px-4 py-3" key={row.label}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] font-semibold text-slate">{row.label}</span>
                      <span className="font-sans text-[12px] font-bold text-ink">{row.value}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full"
                        style={{ backgroundColor: row.color, width: `${row.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-card border border-hairline bg-white/85 p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate">
                  Department coverage
                </p>
                <div className="mt-3 grid gap-2">
                  {operationalAnalytics.serviceDemand.map((item) => (
                    <div className="flex items-center justify-between gap-3" key={item.label}>
                      <span className="truncate text-[12px] font-semibold text-slate">{item.label}</span>
                      <span className="font-sans text-[12px] font-bold text-ink">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DashboardPanel>
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
                          <td className="px-5 py-4 font-sans text-[12px] font-medium text-ink">
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
                        <p className="font-sans text-[11px] text-slate">
                          Arrived {formatTime(doctor.today_checkin)}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-light px-2.5 py-1 font-sans text-[11px] font-semibold text-brand">
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
              {ANALYTICS_PERIODS.map(([period, label]) => (
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
                      interval={getAxisInterval(appointmentPeriod)}
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

              <aside className="flex flex-col justify-between rounded-card border border-hairline/80 bg-canvas p-5">
                <div className="text-center">
                  <div
                    className="mx-auto flex h-36 w-36 items-center justify-center rounded-full p-3 shadow-[inset_0_0_0_1px_rgba(228,232,235,0.9)]"
                    style={{
                      background: `conic-gradient(#7C3AED ${completionRate * 3.6}deg, #EDE9FE 0deg)`,
                    }}
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white shadow-inner">
                      <Activity aria-hidden="true" className="mb-1 h-5 w-5 text-brand" />
                      <span className="font-sans text-[26px] font-bold text-ink">
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
                    <span className="font-sans text-[14px] font-bold text-brand">{todayOpenCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-[#ECFDF5] px-4 py-3">
                    <span className="text-[12px] font-semibold text-[#059669]">Completed today</span>
                    <span className="font-sans text-[14px] font-bold text-[#059669]">{todayCompletedCount}</span>
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
                <div className="m-5 h-[300px] rounded-card bg-mist p-4">
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
                      <p className="mt-2 text-[34px] font-bold leading-none text-ink">
                        {appointmentStatusTotal}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-slate">
                        appointment records in view
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-light px-3 py-1.5 font-sans text-[11px] font-bold text-brand">
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
                          fontFamily="Outfit, sans-serif"
                          fontSize={10}
                          tick={{ fill: '#5B6472' }}
                          tickLine={false}
                          tickMargin={12}
                        />
                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          fontFamily="Outfit, sans-serif"
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
                        <span className="w-8 text-right font-sans text-[12px] font-bold text-ink">
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
                <div className="m-5 h-[300px] rounded-card bg-mist p-4">
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
                      <p className="mt-2 text-[34px] font-bold leading-none text-ink">
                        {workloadTotal}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-slate">
                        cases across active doctors
                      </p>
                    </div>
                    <span className="rounded-full bg-[#EEF2FF] px-3 py-1.5 font-sans text-[11px] font-bold text-brand">
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
                          fontFamily="Outfit, sans-serif"
                          fontSize={10}
                          tick={{ fill: '#5B6472' }}
                          tickLine={false}
                          tickMargin={12}
                        />
                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          fontFamily="Outfit, sans-serif"
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
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-light font-sans text-[11px] font-bold text-brand">
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
                        <span className="w-8 text-right font-sans text-[12px] font-bold text-ink">
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
                <div className="m-5 h-[300px] rounded-card bg-mist p-4">
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
                      <p className="mt-2 text-[34px] font-bold leading-none text-ink">
                        {totalGenderPatients}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-slate">
                        total patient profiles
                      </p>
                    </div>
                    <span className="rounded-full bg-[#CCFBF1] px-3 py-1.5 font-sans text-[11px] font-bold text-[#0F766E]">
                      Top {leadingGender?.label || 'Segment'}
                    </span>
                  </div>

                  <div className="relative mt-2 h-[234px]">
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
                      <span className="font-sans text-[30px] font-bold text-ink">
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
                        <span className="text-right font-sans text-[12px] font-bold text-ink">
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
                    <p className="font-sans text-[11px] text-slate">
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
