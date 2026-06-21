/* src/pages/Appointments.jsx - Manages booking, filtering, and appointment status updates. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarClock, Plus, Search, X, XCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'

import Avatar from '../components/Avatar'
import Drawer from '../components/Drawer'
import SkeletonRow from '../components/SkeletonRow'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { stagger } from '../lib/motion'
import {
  bookAppointment,
  getAppointments,
  getDoctors,
  getPatients,
  updateStatus,
} from '../services/api'

const STATUS_OPTIONS = ['scheduled', 'in_progress', 'completed', 'cancelled']
const STATUS_FILTERS = ['all', ...STATUS_OPTIONS]

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

function getBackendError(error, fallback) {
  const data = error?.response?.data

  if (typeof error?.detail === 'string') {
    return error.detail
  }

  if (typeof data?.detail === 'string') {
    return data.detail
  }

  if (typeof data === 'string') {
    return data
  }

  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([field, messages]) => {
        const message = Array.isArray(messages) ? messages.join(' ') : messages
        return `${field}: ${message}`
      })
      .join(' ')
  }

  return fallback
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

function formatDateParts(value) {
  if (!value) {
    return { date: '-', time: '' }
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return { date: '-', time: '' }
  }

  return {
    date: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  }
}

function getPatientRecord(appointment, patients) {
  if (typeof appointment.patient === 'object') {
    return appointment.patient
  }

  return patients.find(
    (candidate) => String(getRecordId(candidate)) === String(appointment.patient),
  )
}

function getPatientDisplay(appointment, patients) {
  if (appointment.patient_name) {
    return appointment.patient_name
  }

  const patient = getPatientRecord(appointment, patients)

  return getPersonName(patient, 'Unknown patient')
}

function getPatientCondition(appointment, patients) {
  const patient = getPatientRecord(appointment, patients)

  return patient?.condition || 'No condition recorded'
}

function getDoctorRecord(appointment, doctors) {
  if (typeof appointment.doctor === 'object') {
    return appointment.doctor
  }

  return doctors.find(
    (candidate) => String(getRecordId(candidate)) === String(appointment.doctor),
  )
}

function getDoctorDisplay(appointment, doctors) {
  if (appointment.doctor_name) {
    return appointment.doctor_name
  }

  const doctor = getDoctorRecord(appointment, doctors)

  return getPersonName(doctor, 'Unknown doctor')
}

function getSearchableAppointmentText(appointment, patients, doctors) {
  const status = String(appointment.status || 'scheduled')
  const patient = getPatientRecord(appointment, patients)
  const doctor = getDoctorRecord(appointment, doctors)
  const dateParts = formatDateParts(appointment.appointment_dt)

  return [
    getPatientDisplay(appointment, patients),
    patient?.phone,
    patient?.condition,
    appointment.patient,
    getDoctorDisplay(appointment, doctors),
    doctor?.email,
    doctor?.username,
    appointment.doctor,
    appointment.reason,
    status,
    formatStatus(status),
    dateParts.date,
    dateParts.time,
  ]
    .filter(Boolean)
    .join(' ')
    .concat(' ', dateParts.date.replace(/,/g, ''))
    .concat(' ', status.replace(/_/g, ' '))
}

function FieldError({ children }) {
  if (!children) {
    return null
  }

  return (
    <p className="mt-1.5 flex items-center gap-1 text-[12px] font-normal text-rose-500">
      <AlertCircle aria-hidden="true" className="h-[13px] w-[13px]" />
      {children}
    </p>
  )
}

function DrawerField({ children, label, optional }) {
  return (
    <label className="block animate-fade-up">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
        {optional ? (
          <span className="ml-1 text-[12px] font-normal text-slate">
            (optional)
          </span>
        ) : null}
      </span>
      {children}
    </label>
  )
}

export function Appointments() {
  const { user } = useAuth()
  const toast = useToast()
  const canManageAppointments = user?.role !== 'doctor'
  const [searchParams, setSearchParams] = useSearchParams()
  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [flashingRow, setFlashingRow] = useState(null)
  const [successPulse, setSuccessPulse] = useState(false)
  const search = searchParams.get('search') || ''
  const queryStatus = searchParams.get('status')
  const statusFilter = STATUS_OPTIONS.includes(queryStatus) ? queryStatus : 'all'
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm({
    defaultValues: {
      patient: '',
      doctor: '',
      appointment_dt: '',
      reason: '',
      notes: '',
    },
  })

  const loadAppointments = useCallback(async () => {
    const response = await getAppointments()
    setAppointments(normalizeList(response))
  }, [])

  const loadPageData = useCallback(async (isMounted = () => true) => {
    setIsLoading(true)
    setLoadError('')

    const [appointmentsResult, patientsResult, doctorsResult] =
      await Promise.allSettled([getAppointments(), getPatients(), getDoctors()])

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

    setAppointments(normalizeList(appointmentsResult.value))
    setPatients(
      patientsResult.status === 'fulfilled'
        ? normalizeList(patientsResult.value)
        : [],
    )
    setDoctors(
      doctorsResult.status === 'fulfilled' ? normalizeList(doctorsResult.value) : [],
    )
    setIsLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true

    queueMicrotask(() => {
      loadPageData(() => mounted)
    })

    return () => {
      mounted = false
    }
  }, [loadPageData])

  const patientOptions = useMemo(
    () =>
      patients
        .map((patient) => ({
          id: getRecordId(patient),
          label: getPersonName(patient, 'Unnamed patient'),
        }))
        .filter((patient) => patient.id !== undefined && patient.id !== null),
    [patients],
  )

  const doctorOptions = useMemo(
    () =>
      doctors
        .map((doctor) => ({
          id: getRecordId(doctor),
          label: getPersonName(doctor, 'Unnamed doctor'),
        }))
        .filter((doctor) => doctor.id !== undefined && doctor.id !== null),
    [doctors],
  )

  const filteredAppointments = useMemo(() => {
    const searchTerms = normalizeSearchText(search).split(' ').filter(Boolean)

    return appointments.filter((appointment) => {
      const status = String(appointment.status || 'scheduled').toLowerCase()
      const searchableText = normalizeSearchText(
        getSearchableAppointmentText(appointment, patients, doctors),
      )
      const matchesSearch =
        searchTerms.length === 0 ||
        searchTerms.every((term) => searchableText.includes(term))
      const matchesStatus = statusFilter === 'all' || status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [appointments, doctors, patients, search, statusFilter])

  const statusCounts = useMemo(
    () =>
      appointments.reduce(
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
    [appointments],
  )

  async function handleBookAppointment(formValues) {
    setFormError('')

    try {
      await bookAppointment({
        patient: formValues.patient,
        doctor: formValues.doctor,
        appointment_dt: formValues.appointment_dt,
        reason: formValues.reason,
      })
      setSuccessPulse(true)
      toast.success('Appointment booked successfully.')
      await loadAppointments()
      window.setTimeout(() => {
        setSuccessPulse(false)
        reset()
        setDrawerOpen(false)
      }, 300)
    } catch (error) {
      const message = getBackendError(error, 'Appointment could not be booked.')
      setFormError(message)
      toast.error(message)
    }
  }

  async function handleStatusChange(appointmentId, nextStatus) {
    const previousAppointments = appointments
    setFlashingRow(appointmentId)
    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) =>
        getRecordId(appointment) === appointmentId
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
      const message = getBackendError(error, 'Status could not be updated.')
      toast.error(message)
    }
  }

  function updateFilters(nextSearch = search, nextStatus = statusFilter) {
    const nextParams = {}
    const trimmedSearch = nextSearch.trim()

    if (trimmedSearch) {
      nextParams.search = trimmedSearch
    }

    if (nextStatus !== 'all') {
      nextParams.status = nextStatus
    }

    setSearchParams(nextParams, { replace: true })
  }

  function handleSearchChange(event) {
    const nextSearch = event.target.value
    updateFilters(nextSearch, statusFilter)
  }

  function handleStatusFilterChange(nextStatus) {
    updateFilters(search, nextStatus)
  }

  function clearFilters() {
    setSearchParams({}, { replace: true })
  }

  const formInputClass =
    'w-full rounded-control border border-hairline bg-mist/50 px-4 py-2.5 text-[14px] font-normal text-ink outline-none transition-all duration-150 placeholder:text-slate/50 focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/25'

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 rounded-card bg-canvas px-4 py-3 shadow-card xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative block">
            <span className="sr-only">Search appointments</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate"
            />
            <input
              className="h-[38px] w-full rounded-control border border-hairline bg-canvas pl-9 pr-9 text-[14px] font-normal text-ink outline-none transition-all duration-300 placeholder:text-slate/60 focus:border-brand focus:ring-2 focus:ring-brand/30 md:w-[260px]"
              onChange={handleSearchChange}
              placeholder="Search patient, doctor, status"
              type="search"
              value={search}
            />
            {search ? (
              <button
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                onClick={() => {
                  updateFilters('', statusFilter)
                }}
                type="button"
              >
                <span className="sr-only">Clear appointment search</span>
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </label>

          <div className="flex gap-2 overflow-x-auto">
            {STATUS_FILTERS.map((status, index) => {
              const active = statusFilter === status

              return (
                <button
                  className={[
                    'shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-all duration-150 animate-fade-in',
                    active
                      ? 'border-brand/30 bg-brand-light font-semibold text-brand'
                      : 'border-hairline bg-mist text-slate hover:text-ink',
                  ].join(' ')}
                  key={status}
                  onClick={() => handleStatusFilterChange(status)}
                  style={stagger(index, 0.05)}
                  type="button"
                >
                  {status === 'all' ? 'All' : formatStatus(status)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-[12px] font-medium text-slate">
            {statusCounts.total} Total | {statusCounts.scheduled} Scheduled |{' '}
            {statusCounts.in_progress} In Progress | {statusCounts.completed}{' '}
            Completed
          </p>
          {canManageAppointments ? (
            <button
              className="primary-button inline-flex h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
              onClick={() => {
                setFormError('')
                setDrawerOpen(true)
              }}
              type="button"
            >
              <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
              Book Appointment
            </button>
          ) : null}
        </div>
      </section>

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
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="border-b border-hairline bg-mist">
                <tr>
                  {[
                    'Patient',
                    'Doctor',
                    'Date & Time',
                    'Reason',
                    'Status',
                    'Actions',
                  ].map((header) => (
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
                    <SkeletonRow index={index} key={index} />
                  ))
                ) : filteredAppointments.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center" colSpan={6}>
                      <CalendarClock
                        aria-hidden="true"
                        className="mx-auto mb-4 h-10 w-10 text-brand/25"
                      />
                      <p className="text-[16px] font-semibold text-ink">
                        {search.trim() || statusFilter !== 'all'
                          ? 'No matching appointments'
                          : 'No appointments yet'}
                      </p>
                      <p className="mt-1 text-[14px] font-normal text-slate">
                        {search.trim() || statusFilter !== 'all'
                          ? 'Try another search term or clear the status filter.'
                          : 'Book the first appointment to get started'}
                      </p>
                      {search.trim() || statusFilter !== 'all' ? (
                        <button
                          className="mt-4 text-sm font-semibold text-brand transition hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                          onClick={clearFilters}
                          type="button"
                        >
                          Clear filters
                        </button>
                      ) : canManageAppointments ? (
                        <button
                          className="mt-4 text-sm font-semibold text-brand transition hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                          onClick={() => setDrawerOpen(true)}
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
                    const status = appointment.status || 'scheduled'
                    const patientName = getPatientDisplay(appointment, patients)
                    const dateParts = formatDateParts(appointment.appointment_dt)

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
                        <td className="px-5 py-4 text-[14px] font-normal text-ink">
                          {getDoctorDisplay(appointment, doctors)}
                        </td>
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
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-5 py-4">
                          {canManageAppointments ? (
                            <select
                              className="h-8 rounded-control border border-hairline bg-mist px-2 text-[13px] font-medium text-ink outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/30"
                              onChange={(event) =>
                                handleStatusChange(appointmentId, event.target.value)
                              }
                              value={status}
                            >
                              {STATUS_OPTIONS.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>
                                  {formatStatus(statusOption)}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Drawer
        footer={
          <div className="flex justify-end gap-3">
            <button
              className="rounded-control bg-mist px-4 py-2.5 text-[14px] font-medium text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
              onClick={() => setDrawerOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={[
                'primary-button flex min-w-[140px] items-center justify-center rounded-control px-4 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70',
                successPulse ? 'bg-status-completed-text' : 'bg-brand',
              ].join(' ')}
              disabled={isSubmitting}
              form="appointment-form"
              type="submit"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                'Confirm Booking'
              )}
            </button>
          </div>
        }
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        subtitle="Register a new patient visit"
        title="Book Appointment"
      >
        <form
          className="space-y-5"
          id="appointment-form"
          onSubmit={handleSubmit(handleBookAppointment)}
        >
          <DrawerField label="Patient">
            <select
              className={`${formInputClass} ${
                errors.patient ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-400/25' : ''
              }`}
              {...register('patient', { required: 'Patient is required.' })}
            >
              <option value="">Select patient</option>
              {patientOptions.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.label}
                </option>
              ))}
            </select>
            {patientOptions.length === 0 ? (
              <p className="mt-1.5 text-[12px] font-normal text-slate">
                No patients yet - add one on the Patients page.
              </p>
            ) : null}
            <FieldError>{errors.patient?.message}</FieldError>
          </DrawerField>

          <DrawerField label="Doctor">
            <select
              className={`${formInputClass} ${
                errors.doctor ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-400/25' : ''
              }`}
              {...register('doctor', { required: 'Doctor is required.' })}
            >
              <option value="">Select doctor</option>
              {doctorOptions.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.label}
                </option>
              ))}
            </select>
            <FieldError>{errors.doctor?.message}</FieldError>
          </DrawerField>

          <DrawerField label="Date & Time">
            <input
              className={`${formInputClass} font-mono ${
                errors.appointment_dt
                  ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-400/25'
                  : ''
              }`}
              type="datetime-local"
              {...register('appointment_dt', {
                required: 'Date and time are required.',
              })}
            />
            <p className="mt-1.5 text-[11px] font-normal text-slate/60">
              Times are in UTC - Past dates will be rejected
            </p>
            <FieldError>{errors.appointment_dt?.message}</FieldError>
          </DrawerField>

          <DrawerField label="Reason for visit" optional>
            <input
              className={formInputClass}
              placeholder="Routine check-in"
              type="text"
              {...register('reason')}
            />
          </DrawerField>

          <DrawerField label="Notes" optional>
            <textarea
              className={`${formInputClass} min-h-[92px] resize-none`}
              placeholder="Internal notes"
              rows={3}
              {...register('notes')}
            />
          </DrawerField>

          {formError ? (
            <div className="flex animate-fade-up items-start gap-2 rounded-control border border-rose-200 bg-rose-50 px-4 py-3">
              <XCircle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
              />
              <p className="text-[13px] font-medium text-rose-700">{formError}</p>
            </div>
          ) : null}
        </form>
      </Drawer>
    </div>
  )
}

export default Appointments
