/* src/features/appointments/pages/AppointmentView.jsx - Read-only appointment detail page. */
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarClock, Edit } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import PaymentBadge from '../components/PaymentBadge'
import PatientSummaryPanel from '@features/patients/components/PatientSummaryPanel'
import SkeletonRow from '@shared/components/SkeletonRow'
import StatusBadge from '../components/StatusBadge'
import { usePermission } from '@shared/lib/usePermission'
import {
  formatDateTime,
  getAppointmentDoctorName,
  getAppointmentPatientId,
  getBackendError,
  getRecordId,
  getVitalsText,
  normalizeList,
} from '@shared/lib/records'
import {
  getAppointment,
  getDoctors,
  getPatient,
} from '@shared/services/api'

function getEmbeddedAppointmentPatient(appointment) {
  return typeof appointment?.patient === 'object' ? appointment.patient : null
}

export function AppointmentView() {
  const { id } = useParams()
  const { canWrite } = usePermission()
  const navigate = useNavigate()
  const canEdit = canWrite('appointments')
  const [appointment, setAppointment] = useState(null)
  const [patient, setPatient] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notFound, setNotFound] = useState(false)

  const loadAppointment = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    setNotFound(false)

    try {
      const appointmentResponse = await getAppointment(id)
      const embeddedPatient = getEmbeddedAppointmentPatient(appointmentResponse)
      const patientId = getAppointmentPatientId(appointmentResponse)
      const [patientResponse, doctorsResponse] = await Promise.allSettled([
        patientId ? getPatient(patientId) : Promise.resolve(embeddedPatient),
        getDoctors(),
      ])

      setAppointment(appointmentResponse)
      setPatient(
        patientResponse.status === 'fulfilled'
          ? patientResponse.value || embeddedPatient
          : embeddedPatient,
      )
      setDoctors(
        doctorsResponse.status === 'fulfilled'
          ? normalizeList(doctorsResponse.value)
          : [],
      )
    } catch (error) {
      if (error?.response?.status === 404) {
        setNotFound(true)
      } else {
        setLoadError(getBackendError(error, 'Appointment could not be loaded.'))
      }
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    queueMicrotask(() => {
      loadAppointment()
    })
  }, [loadAppointment])

  if (notFound) {
    return (
      <section className="mx-auto max-w-2xl rounded-card bg-canvas p-10 text-center shadow-card animate-fade-up">
        <h2 className="text-[18px] font-bold text-ink">Appointment not found</h2>
        <p className="mt-2 text-[14px] font-normal text-slate">
          The appointment record could not be found.
        </p>
        <Link
          className="mt-6 inline-flex items-center rounded-control border border-hairline bg-canvas px-4 py-2 text-sm font-semibold text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          to="/appointments"
        >
          <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
          Back to appointments
        </Link>
      </section>
    )
  }

  if (loadError) {
    return (
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
          className="mt-5 rounded-control border border-hairline bg-canvas px-4 py-2 text-sm font-semibold text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          onClick={loadAppointment}
          type="button"
        >
          Try again
        </button>
      </section>
    )
  }

  if (isLoading || !appointment) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonRow index={index} key={index} variant="form" />
        ))}
      </div>
    )
  }

  const vitalsText = getVitalsText(appointment)

  return (
    <div className="mx-auto max-w-2xl">
      <section className="rounded-card bg-canvas p-8 shadow-card animate-fade-up">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-ink">
              Appointment Details
            </h1>
            <p className="mt-1 text-[14px] font-normal text-slate">
              Read-only visit record
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <button
                className="inline-flex h-10 items-center justify-center rounded-control border border-brand/20 bg-brand-light px-3 text-[13px] font-semibold text-brand transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                onClick={() => navigate(`/appointments/${id}/edit`)}
                type="button"
              >
                <Edit aria-hidden="true" className="mr-2 h-4 w-4" />
                Edit
              </button>
            ) : null}
            <Link
              className="inline-flex h-10 items-center justify-center rounded-control bg-mist px-3 text-[13px] font-semibold text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              to="/appointments"
            >
              <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
              Back
            </Link>
          </div>
        </div>

        <PatientSummaryPanel
          link={patient ? `/patients/${getRecordId(patient)}` : ''}
          patient={patient}
        />

        <div className="mt-8 space-y-6">
          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">
                Doctor
              </p>
              <p className="mt-1 text-[14px] font-medium text-ink">
                {getAppointmentDoctorName(appointment, doctors)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">
                Date & Time
              </p>
              <p className="mt-1 font-mono text-[13px] font-medium text-ink">
                {formatDateTime(appointment.appointment_dt)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">
                Reason
              </p>
              <p className="mt-1 text-[14px] font-normal text-ink">
                {appointment.reason || 'Not recorded'}
              </p>
            </div>
          </section>

          {vitalsText ? (
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate">
                Vitals
              </p>
              <span className="rounded bg-mist px-2 py-0.5 font-mono text-[12px] text-ink">
                {vitalsText}
              </span>
            </section>
          ) : null}

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate">
              Clinical Notes / Piece Field
            </p>
            <div className="rounded-control border border-hairline bg-mist px-4 py-3 text-[13px] font-normal leading-6 text-slate">
              {appointment.notes || (
                <span className="italic text-slate/50">No notes recorded.</span>
              )}
            </div>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-hairline bg-mist px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">
                Payment
              </p>
              <div className="mt-2">
                <PaymentBadge large status={appointment.payment_status} />
              </div>
            </div>
            <StatusBadge status={appointment.status || 'scheduled'} />
          </section>

          <section>
            <p className="text-[12px] font-medium text-slate">
              Booked by {appointment.booked_by_name || 'Unknown'} on{' '}
              {formatDateTime(appointment.booked_at)}
            </p>
          </section>
        </div>
      </section>
    </div>
  )
}

export default AppointmentView
