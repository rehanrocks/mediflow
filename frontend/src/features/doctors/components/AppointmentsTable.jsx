/* src/features/doctors/components/AppointmentsTable.jsx - Doctor appointments history. */
import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'

import PaymentBadge from '@features/appointments/components/PaymentBadge'
import StatusBadge from '@features/appointments/components/StatusBadge'
import Avatar from '@shared/components/Avatar'
import Pagination from '@shared/components/Pagination'
import SkeletonRow from '@shared/components/SkeletonRow'
import { useToast } from '@shared/components/Toast'
import {
  PAGE_SIZE,
  normalizePaginatedResponse,
  pageParams,
} from '@shared/lib/pagination'
import { formatDateParts, getBackendError } from '@shared/lib/records'
import { usePermission } from '@shared/lib/usePermission'
import { getDoctorAppointments } from '@shared/services/api'

const STATUS_FILTERS = [
  ['all', 'All'],
  ['scheduled', 'Scheduled'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
]

export function AppointmentsTable({ doctorId }) {
  const toast = useToast()
  const { canViewFullDoctorProfile } = usePermission()
  const [appointments, setAppointments] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const canView = canViewFullDoctorProfile(doctorId)

  useEffect(() => {
    let mounted = true

    async function loadInitialAppointments() {
      if (!canView) {
        setAppointments([])
        setTotal(0)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setAppointments([])

      try {
        const appointmentOrdering =
          statusFilter === 'completed' || statusFilter === 'cancelled'
            ? '-appointment_dt'
            : 'appointment_dt'
        const response = await getDoctorAppointments(doctorId, {
          ...pageParams(page),
          ordering: appointmentOrdering,
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        })
        const normalized = normalizePaginatedResponse(response)

        if (mounted) {
          setAppointments(normalized.results)
          setTotal(normalized.count)
        }
      } catch (error) {
        if (mounted) {
          toast.error(getBackendError(error, 'Appointments could not be loaded.'))
          setAppointments([])
          setTotal(0)
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
  }, [canView, doctorId, page, statusFilter, toast])

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
              onClick={() => {
                setStatusFilter(status)
                setPage(1)
              }}
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
              Array.from({ length: PAGE_SIZE }).map((_, index) => (
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
            ) : (
              appointments.map((appointment) => {
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
                    <td className="px-5 py-4 font-sans text-[13px] text-ink">
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

      <Pagination
        currentPage={page}
        onPageChange={setPage}
        totalCount={total}
      />
    </section>
  )
}

export default AppointmentsTable
