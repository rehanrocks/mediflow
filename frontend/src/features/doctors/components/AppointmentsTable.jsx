/* src/features/doctors/components/AppointmentsTable.jsx - Doctor appointments history. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'

import PaymentBadge from '@features/appointments/components/PaymentBadge'
import StatusBadge from '@features/appointments/components/StatusBadge'
import Avatar from '@shared/components/Avatar'
import SkeletonRow from '@shared/components/SkeletonRow'
import { useToast } from '@shared/components/Toast'
import { canViewDoctorAppointments } from '@shared/lib/permissions'
import { formatDateParts, getBackendError } from '@shared/lib/records'
import { getDoctorAppointments } from '@shared/services/api'

const STATUS_FILTERS = [
  ['all', 'All'],
  ['scheduled', 'Scheduled'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
]

function getNextParams(nextUrl) {
  if (!nextUrl) return null

  try {
    const url = new URL(nextUrl, 'http://mediflow.local')
    return Object.fromEntries(url.searchParams.entries())
  } catch {
    return null
  }
}

export function AppointmentsTable({ currentUser, doctorId }) {
  const toast = useToast()
  const [appointments, setAppointments] = useState([])
  const [nextPage, setNextPage] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const canView = canViewDoctorAppointments(currentUser, doctorId)

  const fetchAppointments = useCallback(
    async ({ append = false, params = {} } = {}) => {
      const response = await getDoctorAppointments(doctorId, {
        limit: 10,
        ordering: '-appointment_dt',
        ...params,
      })

      setAppointments((currentAppointments) =>
        append
          ? [...currentAppointments, ...(response.results || [])]
          : response.results || [],
      )
      setNextPage(response.next || null)
    },
    [doctorId],
  )

  useEffect(() => {
    let mounted = true

    async function loadInitialAppointments() {
      if (!canView) {
        setAppointments([])
        setNextPage(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      try {
        const response = await getDoctorAppointments(doctorId, {
          limit: 10,
          ordering: '-appointment_dt',
        })

        if (mounted) {
          setAppointments(response.results || [])
          setNextPage(response.next || null)
        }
      } catch (error) {
        if (mounted) {
          toast.error(getBackendError(error, 'Appointments could not be loaded.'))
          setAppointments([])
          setNextPage(null)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadInitialAppointments()

    return () => {
      mounted = false
    }
  }, [canView, doctorId, toast])

  const filteredAppointments = useMemo(() => {
    if (statusFilter === 'all') return appointments
    return appointments.filter((appointment) => appointment.status === statusFilter)
  }, [appointments, statusFilter])

  async function handleLoadMore() {
    const params = getNextParams(nextPage)

    if (!params) return

    setIsLoadingMore(true)

    try {
      await fetchAppointments({ append: true, params })
    } catch (error) {
      toast.error(getBackendError(error, 'More appointments could not be loaded.'))
    } finally {
      setIsLoadingMore(false)
    }
  }

  if (!canView) {
    return null
  }

  return (
    <section className="overflow-hidden rounded-card bg-canvas shadow-card">
      <div className="flex flex-col gap-3 border-b border-hairline px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[16px] font-bold text-ink">Appointments</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(([status, label]) => (
            <button
              className={[
                'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all',
                statusFilter === status
                  ? 'border-brand/30 bg-brand-light text-brand'
                  : 'border-hairline bg-mist text-slate hover:border-brand/30 hover:text-brand',
              ].join(' ')}
              key={status}
              onClick={() => setStatusFilter(status)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className="border-b border-hairline bg-mist">
            <tr>
              {[
                'Patient',
                'Date & Time',
                'Reason',
                'Diagnosis',
                'Status',
                'Payment',
              ].map((header) => (
                <th
                  className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate"
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
                <SkeletonRow columns={6} index={index} key={index} />
              ))
            ) : appointments.length === 0 ? (
              <tr>
                <td className="px-5 py-12 text-center" colSpan={6}>
                  <CalendarClock
                    aria-hidden="true"
                    className="mx-auto mb-3 h-9 w-9 text-brand/20"
                  />
                  <p className="text-[15px] font-semibold text-ink">
                    No appointments yet
                  </p>
                </td>
              </tr>
            ) : filteredAppointments.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-[13px] text-slate" colSpan={6}>
                  No {statusFilter} appointments
                </td>
              </tr>
            ) : (
              filteredAppointments.map((appointment) => {
                const dateParts = formatDateParts(appointment.appointment_dt)

                return (
                  <tr
                    className="border-b border-hairline transition-colors duration-100 last:border-0 hover:bg-brand-light/40"
                    key={appointment.id}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={appointment.patient_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-ink">
                            {appointment.patient_name}
                          </p>
                          <p className="text-[12px] text-slate">
                            {appointment.patient_age ?? '-'} yrs
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-[13px] text-ink">
                      {dateParts.date}
                      {dateParts.time ? (
                        <>
                          <span className="px-1.5 text-slate/50">|</span>
                          {dateParts.time}
                        </>
                      ) : null}
                    </td>
                    <td
                      className="max-w-[180px] truncate px-5 py-4 text-[13px] text-ink"
                      title={appointment.reason || ''}
                    >
                      {appointment.reason || '-'}
                    </td>
                    <td
                      className="max-w-[180px] truncate px-5 py-4 text-[13px] text-ink"
                      title={appointment.diagnosis || ''}
                    >
                      {appointment.diagnosis || (
                        <span className="text-slate/40">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={appointment.status} />
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

      {nextPage ? (
        <div className="border-t border-hairline py-4 text-center">
          <button
            className="rounded-control border border-hairline bg-canvas px-4 py-2 text-[13px] font-semibold text-slate transition hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoadingMore}
            onClick={handleLoadMore}
            type="button"
          >
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      ) : null}
    </section>
  )
}

export default AppointmentsTable
