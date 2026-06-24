/* src/features/appointments/pages/Appointments.jsx - Appointment list with RBAC actions. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  CalendarClock,
  Eye,
  Info,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import Avatar from '@shared/components/Avatar'
import ConfirmationModal from '@shared/components/ConfirmationModal'
import Pagination from '@shared/components/Pagination'
import PaymentBadge, { PaymentToggle } from '../components/PaymentBadge'
import SkeletonRow from '@shared/components/SkeletonRow'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '@shared/components/Toast'
import { useAuth } from '@shared/context/AuthContext'
import {
  APPOINTMENT_STATUS_OPTIONS,
  canTransitionAppointmentStatus,
  getAllowedAppointmentStatuses,
  getStatusTransitionMessage,
  isTerminalAppointmentStatus,
  normalizeAppointmentStatus,
} from '@shared/lib/appointmentStatus'
import { stagger } from '@shared/lib/motion'
import {
  formatDateParts,
  getAppointmentDoctorId,
  getAppointmentDoctorName,
  getAppointmentPatientName,
  getBackendError,
  getPaymentStatus,
  getPatientConditions,
  getRecordId,
  getVitalsText,
  normalizeList,
  resolvePatient,
} from '@shared/lib/records'
import {
  PAGE_SIZE,
  normalizePaginatedResponse,
  pageParams,
} from '@shared/lib/pagination'
import { getUserDoctorId, usePermission } from '@shared/lib/usePermission'
import {
  deleteAppointment,
  getAppointments,
  getDoctors,
  getPatients,
  updatePaymentStatus,
  updateStatus,
} from '@shared/services/api'

const STATUS_OPTIONS = APPOINTMENT_STATUS_OPTIONS

const PERIOD_OPTIONS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
]

function getPeriodRange(period) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const start = new Date(today)
  if (period === 'day') { start.setHours(0, 0, 0, 0); return { start, end: today } }
  if (period === 'week') { start.setDate(today.getDate() - 6); start.setHours(0, 0, 0, 0); return { start, end: today } }
  if (period === 'month') { start.setDate(today.getDate() - 29); start.setHours(0, 0, 0, 0); return { start, end: today } }
  start.setMonth(today.getMonth() - 11); start.setDate(1); start.setHours(0, 0, 0, 0)
  return { start, end: today }
}

function getAppointmentDate(appointment) {
  const value = appointment.appointment_dt || appointment.date
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
const STATUS_TONES = {
  all: {
    active: 'border-brand/30 bg-brand-light font-semibold text-brand',
    inactive: 'border-hairline bg-mist text-slate hover:border-brand/30 hover:text-brand',
  },
  scheduled: {
    active:
      'border-status-scheduled-text/30 bg-status-scheduled-bg font-semibold text-status-scheduled-text',
    inactive:
      'border-status-scheduled-text/20 bg-status-scheduled-bg/45 text-status-scheduled-text hover:bg-status-scheduled-bg',
    select:
      'border-status-scheduled-text/30 bg-status-scheduled-bg text-status-scheduled-text',
  },
  in_progress: {
    active:
      'border-status-inProgress-text/30 bg-status-inProgress-bg font-semibold text-status-inProgress-text',
    inactive:
      'border-status-inProgress-text/20 bg-status-inProgress-bg/45 text-status-inProgress-text hover:bg-status-inProgress-bg',
    select:
      'border-status-inProgress-text/30 bg-status-inProgress-bg text-status-inProgress-text',
  },
  completed: {
    active:
      'border-status-completed-text/30 bg-status-completed-bg font-semibold text-status-completed-text',
    inactive:
      'border-status-completed-text/20 bg-status-completed-bg/45 text-status-completed-text hover:bg-status-completed-bg',
    select:
      'border-status-completed-text/30 bg-status-completed-bg text-status-completed-text',
  },
  cancelled: {
    active:
      'border-status-cancelled-text/30 bg-status-cancelled-bg font-semibold text-status-cancelled-text',
    inactive:
      'border-status-cancelled-text/20 bg-status-cancelled-bg/45 text-status-cancelled-text hover:bg-status-cancelled-bg',
    select:
      'border-status-cancelled-text/30 bg-status-cancelled-bg text-status-cancelled-text',
  },
}

function formatStatus(status) {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_|,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getPatientCondition(appointment, patients) {
  const patient = resolvePatient(appointment, patients)
  const conditions = getPatientConditions(patient)

  return conditions[0] || 'No condition recorded'
}

function getSearchableAppointmentText(appointment, patients, doctors) {
  const status = String(appointment.status || 'scheduled')
  const dateParts = formatDateParts(appointment.appointment_dt)

  return [
    getAppointmentPatientName(appointment, patients),
    resolvePatient(appointment, patients)?.phone,
    getPatientCondition(appointment, patients),
    getAppointmentDoctorName(appointment, doctors),
    appointment.reason,
    appointment.temperature,
    appointment.blood_pressure,
    appointment.payment_status,
    status,
    formatStatus(status),
    dateParts.date,
    dateParts.time,
  ]
    .filter(Boolean)
    .join(' ')
    .concat(' ', status.replace(/_/g, ' '))
}

function canUserSeeAppointment(appointment, user, role) {
  const currentDoctorId = getUserDoctorId(user)

  if (
    role?.slug === 'doctor' &&
    currentDoctorId &&
    String(getAppointmentDoctorId(appointment)) !== String(currentDoctorId)
  ) {
    return false
  }

  return true
}

export function Appointments() {
  const { user } = useAuth()
  const { canDelete: canDeleteRecords, canWrite, role } = usePermission()
  const toast = useToast()
  const navigate = useNavigate()
  const doctorUser = role?.slug === 'doctor'
  const canBook = canWrite('appointments')
  const canEdit = canWrite('appointments')
  const canUpdateStatus = canWrite('appointments')
  const canUpdatePayment = canWrite('appointments')
  const canDelete = canDeleteRecords()
  const [searchParams, setSearchParams] = useSearchParams()
  const [appointments, setAppointments] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [flashingRow, setFlashingRow] = useState(null)
  const [updatingPaymentId, setUpdatingPaymentId] = useState(null)
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [isDeletingAppointment, setIsDeletingAppointment] = useState(false)
  const search = searchParams.get('search') || ''
  const queryStatus = searchParams.get('status')
  const statusFilter = STATUS_OPTIONS.includes(queryStatus) ? queryStatus : 'all'
  const queryPeriod = searchParams.get('period')
  const periodFilter = PERIOD_OPTIONS.some((p) => p.key === queryPeriod) ? queryPeriod : 'all'

  const loadPageData = useCallback(async (isMounted = () => true) => {
    setIsLoading(true)
    setLoadError('')
    setAppointments([])

    const appointmentOrdering =
      statusFilter === 'completed' || statusFilter === 'cancelled'
        ? '-appointment_dt'
        : 'appointment_dt'
    const appointmentParams = {
      ...pageParams(page),
      ordering: appointmentOrdering,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(periodFilter !== 'all' ? { period: periodFilter } : {}),
    }

    const [appointmentsResult, patientsResult, doctorsResult] =
      await Promise.allSettled([
        getAppointments(appointmentParams),
        getPatients(),
        getDoctors(),
      ])

    if (!isMounted()) {
      return
    }

    if (appointmentsResult.status === 'rejected') {
      setLoadError(
        getBackendError(
          appointmentsResult.reason,
          'Appointments could not be loaded.',
        ),
      )
      setIsLoading(false)
      return
    }

    const normalizedAppointments = normalizePaginatedResponse(appointmentsResult.value)

    setAppointments(normalizedAppointments.results)
    setTotal(normalizedAppointments.count)
    setPatients(
      patientsResult.status === 'fulfilled'
        ? normalizeList(patientsResult.value)
        : [],
    )
    setDoctors(
      doctorsResult.status === 'fulfilled' ? normalizeList(doctorsResult.value) : [],
    )
    setIsLoading(false)
  }, [page, periodFilter, search, statusFilter])

  useEffect(() => {
    let mounted = true

    queueMicrotask(() => {
      loadPageData(() => mounted)
    })

    return () => {
      mounted = false
    }
  }, [loadPageData])

  const roleVisibleAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        canUserSeeAppointment(appointment, user, role),
      ),
    [appointments, role, user],
  )

  const filteredAppointments = useMemo(() => {
    const searchTerms = normalizeSearchText(search).split(' ').filter(Boolean)
    const periodRange = periodFilter !== 'all' ? getPeriodRange(periodFilter) : null

    return roleVisibleAppointments.filter((appointment) => {
      const status = String(appointment.status || 'scheduled').toLowerCase()
      const searchableText = normalizeSearchText(
        getSearchableAppointmentText(appointment, patients, doctors),
      )
      const matchesSearch =
        searchTerms.length === 0 ||
        searchTerms.every((term) => searchableText.includes(term))
      const matchesStatus = statusFilter === 'all' || status === statusFilter

      if (!matchesSearch || !matchesStatus) return false

      if (periodRange) {
        const d = getAppointmentDate(appointment)
        if (!d || d < periodRange.start || d > periodRange.end) return false
      }

      return true
    })
  }, [doctors, patients, roleVisibleAppointments, search, statusFilter, periodFilter])

  const statusCounts = useMemo(
    () =>
      roleVisibleAppointments.reduce(
        (counts, appointment) => {
          const status = String(appointment.status || 'scheduled').toLowerCase()
          counts.total += 1
          counts[status] = (counts[status] || 0) + 1
          return counts
        },
        {
          total: 0,
          scheduled: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0,
        },
      ),
    [roleVisibleAppointments],
  )

  const tableHeaders = doctorUser
    ? ['Patient', 'Date & Time', 'Reason', 'Vitals', 'Payment', 'Status', 'Details']
    : ['Patient', 'Doctor', 'Date & Time', 'Reason', 'Vitals', 'Payment', 'Status', 'Actions']

  function updateFilters(nextSearch = search, nextStatus = statusFilter, nextPeriod = periodFilter) {
    const nextParams = {}
    const trimmedSearch = nextSearch.trim()

    if (trimmedSearch) {
      nextParams.search = trimmedSearch
    }

    if (nextStatus !== 'all') {
      nextParams.status = nextStatus
    }

    if (nextPeriod !== 'all') {
      nextParams.period = nextPeriod
    }

    setPage(1)
    setSearchParams(nextParams, { replace: true })
  }

  async function handleStatusChange(appointmentId, nextStatus) {
    const currentAppointment = appointments.find(
      (appointment) => String(getRecordId(appointment)) === String(appointmentId),
    )
    const currentStatus = normalizeAppointmentStatus(currentAppointment?.status)

    if (!canTransitionAppointmentStatus(currentStatus, nextStatus)) {
      toast.info(getStatusTransitionMessage(currentStatus, nextStatus))
      return
    }

    if (currentStatus === normalizeAppointmentStatus(nextStatus)) {
      return
    }

    const previousAppointments = appointments
    setFlashingRow(appointmentId)
    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) =>
        String(getRecordId(appointment)) === String(appointmentId)
          ? { ...appointment, status: nextStatus }
          : appointment,
      ),
    )
    window.setTimeout(() => setFlashingRow(null), 400)

    try {
      await updateStatus(appointmentId, nextStatus)
      toast.success('Appointment status updated.')
    } catch (error) {
      setAppointments(previousAppointments)
      toast.error(getBackendError(error, 'Status could not be updated.'))
    }
  }

  async function handlePaymentChange(appointmentId, nextPaymentStatus) {
    const currentAppointment = appointments.find(
      (appointment) => String(getRecordId(appointment)) === String(appointmentId),
    )

    if (
      getPaymentStatus(currentAppointment?.payment_status) === 'paid' &&
      nextPaymentStatus === 'unpaid'
    ) {
      toast.info('Paid appointments cannot be reverted to unpaid.')
      return
    }

    const previousAppointments = appointments
    setUpdatingPaymentId(appointmentId)
    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) =>
        String(getRecordId(appointment)) === String(appointmentId)
          ? { ...appointment, payment_status: nextPaymentStatus }
          : appointment,
      ),
    )

    try {
      await updatePaymentStatus(appointmentId, nextPaymentStatus)
      toast.success('Payment status updated.')
    } catch (error) {
      setAppointments(previousAppointments)
      toast.error(getBackendError(error, 'Payment status could not be updated.'))
    } finally {
      setUpdatingPaymentId(null)
    }
  }

  async function handleDeleteAppointment() {
    if (!deleteCandidate) {
      return
    }

    setIsDeletingAppointment(true)

    try {
      await deleteAppointment(deleteCandidate.id)
      setAppointments((currentAppointments) =>
        currentAppointments.filter(
          (appointment) =>
            String(getRecordId(appointment)) !== String(deleteCandidate.id),
        ),
      )
      toast.success('Appointment deleted.')
      setDeleteCandidate(null)
    } catch (error) {
      toast.error(getBackendError(error, 'Appointment could not be deleted.'))
    } finally {
      setIsDeletingAppointment(false)
    }
  }

  function clearFilters() {
    setPage(1)
    setSearchParams({}, { replace: true })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-card bg-canvas p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block min-w-0">
            <span className="sr-only">Search appointments</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate"
            />
            <input
              className="h-11 w-full rounded-control border border-hairline bg-canvas pl-9 pr-9 text-[14px] font-normal text-ink outline-none transition-all duration-300 placeholder:text-slate/60 focus:border-brand focus:ring-2 focus:ring-brand/30 lg:w-[460px]"
              onChange={(event) => updateFilters(event.target.value, statusFilter)}
              placeholder="Search patient, doctor, status"
              type="search"
              value={search}
            />
            {search ? (
              <button
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                onClick={() => updateFilters('', statusFilter)}
                type="button"
              >
                <span className="sr-only">Clear appointment search</span>
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </label>

          {canBook ? (
            <button
              className="primary-button inline-flex h-11 w-full items-center justify-center rounded-control bg-brand px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 sm:w-auto lg:min-w-[190px]"
              onClick={() => navigate('/appointments/book')}
              type="button"
            >
              <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
              Book Appointment
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-2 border-t border-hairline pt-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['all', 'All', statusCounts.total],
            ['scheduled', 'Scheduled', statusCounts.scheduled],
            ['in_progress', 'In Progress', statusCounts.in_progress],
            ['completed', 'Completed', statusCounts.completed],
            ['cancelled', 'Cancelled', statusCounts.cancelled],
          ].map(([status, label, count], index) => {
            const active = statusFilter === status

            return (
              <button
                className={[
                  'flex h-11 items-center justify-between rounded-control border px-3.5 text-left transition-all duration-150 animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                  active
                    ? STATUS_TONES[status].active
                    : STATUS_TONES[status].inactive,
                ].join(' ')}
                key={status}
                onClick={() => updateFilters(search, status)}
                style={stagger(index, 0.04)}
                type="button"
              >
                <span className="truncate text-[12px] font-semibold uppercase tracking-wide">
                  {label}
                </span>
                <span className="ml-3 rounded-full bg-canvas/80 px-2 py-0.5 font-mono text-[12px] font-semibold shadow-sm">
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate">Period:</span>
          {[
            { key: 'all', label: 'All' },
            ...PERIOD_OPTIONS,
          ].map(({ key, label }) => {
            const isActive = periodFilter === key
            return (
              <button
                className={[
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                  isActive
                    ? 'border-brand/30 bg-brand-light text-brand font-semibold'
                    : 'border-hairline bg-mist text-slate hover:border-slate/30 hover:text-ink',
                ].join(' ')}
                key={key}
                onClick={() => updateFilters(search, statusFilter, key)}
                type="button"
              >
                {key === 'day' ? <Calendar aria-hidden="true" className="h-3 w-3" /> : null}
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {doctorUser ? (
        <section className="rounded-control bg-brand-light/50 px-4 py-2.5 text-[13px] font-normal text-slate">
          <p className="inline-flex items-center gap-2">
            <Info aria-hidden="true" className="h-[14px] w-[14px] text-brand" />
            Showing your appointments only.
          </p>
        </section>
      ) : null}

      {loadError ? (
        <section className="rounded-card bg-canvas p-10 text-center shadow-card">
          <CalendarClock
            aria-hidden="true"
            className="mx-auto mb-4 h-10 w-10 text-slate/30"
          />
          <h2 className="text-[16px] font-semibold text-ink">
            Something went wrong
          </h2>
          <p className="mt-1 text-[14px] font-normal text-slate">{loadError}</p>
          <button
            className="mt-5 rounded-control border border-hairline bg-canvas px-4 py-2 text-sm font-semibold text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            onClick={() => loadPageData()}
            type="button"
          >
            Try again
          </button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-card bg-canvas shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead className="border-b border-hairline bg-mist">
                <tr>
                  {tableHeaders.map((header) => (
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
                  Array.from({ length: PAGE_SIZE }).map((_, index) => (
                    <SkeletonRow columns={tableHeaders.length} index={index} key={index} />
                  ))
                ) : filteredAppointments.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center" colSpan={tableHeaders.length}>
                      <CalendarClock
                        aria-hidden="true"
                        className="mx-auto mb-4 h-10 w-10 text-brand/25"
                      />
                      <p className="text-[16px] font-semibold text-ink">
                        {search.trim() || statusFilter !== 'all' || periodFilter !== 'all'
                          ? 'No matching appointments'
                          : 'No appointments yet'}
                      </p>
                      <p className="mt-1 text-[14px] font-normal text-slate">
                        {search.trim() || statusFilter !== 'all' || periodFilter !== 'all'
                          ? 'Try another search term or clear the filters.'
                          : 'Book the first appointment to get started'}
                      </p>
                      {search.trim() || statusFilter !== 'all' || periodFilter !== 'all' ? (
                        <button
                          className="mt-4 text-sm font-semibold text-brand transition hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                          onClick={clearFilters}
                          type="button"
                        >
                          Clear filters
                        </button>
                      ) : canBook ? (
                        <button
                          className="mt-4 text-sm font-semibold text-brand transition hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                          onClick={() => navigate('/appointments/book')}
                          type="button"
                        >
                          + Book Appointment
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((appointment, index) => {
                    const appointmentId = getRecordId(appointment)
                    const status = normalizeAppointmentStatus(appointment.status)
                    const allowedStatusOptions =
                      getAllowedAppointmentStatuses(status)
                    const patientName = getAppointmentPatientName(
                      appointment,
                      patients,
                    )
                    const dateParts = formatDateParts(appointment.appointment_dt)
                    const vitalsText = getVitalsText(appointment)

                    return (
                      <tr
                        className={[
                          'animate-fade-up border-b border-hairline transition-colors duration-100 last:border-0 hover:bg-brand-light/40',
                          flashingRow === appointmentId ? 'bg-brand-light' : '',
                        ].join(' ')}
                        key={appointmentId}
                        style={stagger(index, 0.03)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={patientName} size="md" />
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-medium text-ink">
                                {patientName}
                              </p>
                              <p className="truncate text-[12px] font-normal text-slate">
                                {getPatientCondition(appointment, patients)}
                              </p>
                            </div>
                        </div>
                      </td>
                        {!doctorUser ? (
                          <td className="px-5 py-4 text-[14px] font-normal text-ink">
                            {getAppointmentDoctorName(appointment, doctors)}
                          </td>
                        ) : null}
                        <td className="px-5 py-4 font-mono text-[13px] font-medium text-ink">
                          {dateParts.date}
                          {dateParts.time ? (
                            <>
                              <span className="px-1.5 text-slate/50">|</span>
                              {dateParts.time}
                            </>
                          ) : null}
                        </td>
                        <td
                          className="max-w-[180px] truncate px-5 py-4 text-[13px] font-normal text-slate"
                          title={appointment.reason || 'No reason provided'}
                        >
                          {appointment.reason || '-'}
                        </td>
                        <td className="px-5 py-4">
                          {vitalsText ? (
                            <span className="rounded bg-mist px-2 py-0.5 font-mono text-[12px] text-ink">
                              {vitalsText}
                            </span>
                          ) : (
                            <span className="text-slate/40">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {canUpdatePayment ? (
                            <PaymentToggle
                              disabled={updatingPaymentId === appointmentId}
                              lockPaid
                              onChange={(nextPaymentStatus) =>
                                handlePaymentChange(appointmentId, nextPaymentStatus)
                              }
                              value={appointment.payment_status}
                            />
                          ) : (
                            <PaymentBadge status={appointment.payment_status} />
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {canUpdateStatus ? (
                            <select
                              className={[
                                'h-8 rounded-control border px-2 text-[13px] font-semibold outline-none transition-all focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-80',
                                STATUS_TONES[status]?.select ||
                                  'border-hairline bg-mist text-ink',
                              ].join(' ')}
                              disabled={isTerminalAppointmentStatus(status)}
                              onChange={(event) =>
                                handleStatusChange(appointmentId, event.target.value)
                              }
                              title={
                                isTerminalAppointmentStatus(status)
                                  ? getStatusTransitionMessage(status, 'scheduled')
                                  : 'Change appointment status'
                              }
                              value={status}
                            >
                              {allowedStatusOptions.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>
                                  {formatStatus(statusOption)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <StatusBadge status={status} />
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              className="rounded-lg border border-blue-200 bg-blue-50 p-1.5 text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                              onClick={() => navigate(`/appointments/${appointmentId}`)}
                              title="View appointment"
                              type="button"
                            >
                              <span className="sr-only">View appointment</span>
                              <Eye aria-hidden="true" className="h-4 w-4" />
                            </button>
                            {canEdit ? (
                              <button
                                className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                                onClick={() =>
                                  navigate(`/appointments/${appointmentId}/edit`)
                                }
                                title="Edit appointment"
                                type="button"
                              >
                                <span className="sr-only">Edit appointment</span>
                                <Pencil aria-hidden="true" className="h-4 w-4" />
                              </button>
                            ) : null}
                            {canDelete ? (
                              <button
                                className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                                onClick={() =>
                                  setDeleteCandidate({
                                    id: appointmentId,
                                    patientName,
                                  })
                                }
                                title="Delete appointment"
                                type="button"
                              >
                                <span className="sr-only">Delete appointment</span>
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            onPageChange={setPage}
            totalCount={total}
          />
        </section>
      )}

      {deleteCandidate ? (
        <ConfirmationModal
          body={
            <>
              This will permanently delete the appointment for{' '}
              <span className="font-semibold text-ink">
                {deleteCandidate.patientName}
              </span>.
            </>
          }
          confirmLabel="Delete Appointment"
          isLoading={isDeletingAppointment}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={handleDeleteAppointment}
          title="Delete appointment?"
        />
      ) : null}
    </div>
  )
}

export default Appointments
