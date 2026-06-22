/* src/pages/PatientView.jsx - Read-only patient profile and visit history. */
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  Edit,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'

import Avatar from '../components/Avatar'
import ConfirmationModal from '../components/ConfirmationModal'
import PaymentBadge from '../components/PaymentBadge'
import SkeletonRow from '../components/SkeletonRow'
import StatusBadge from '../components/StatusBadge'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import {
  formatDate,
  formatDateParts,
  formatDateTime,
  getAppointmentDoctorName,
  getBackendError,
  getPatientAge,
  getPatientAllergies,
  getPatientConditions,
  getPatientMedications,
  getPatientName,
  getRecordId,
  getVitalsText,
  normalizeList,
  normalizeStringArray,
} from '../lib/records'
import {
  deletePatient,
  getAppointments,
  getDoctors,
  getPatient,
} from '../services/api'

function Chip({ children, tone }) {
  const toneClass = {
    rose: 'border-rose-200 bg-rose-50 text-rose-600',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    brand: 'border-brand/20 bg-brand-light text-brand',
  }[tone]

  return (
    <span
      className={[
        'inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium',
        toneClass,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

function ChipList({ empty, items, tone }) {
  if (!items.length) {
    return <p className="text-[13px] italic text-slate/50">{empty}</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Chip key={item} tone={tone}>
          {item}
        </Chip>
      ))}
    </div>
  )
}

function NoteBlock({ amber = false, children, icon = false }) {
  return (
    <div
      className={[
        'rounded-control border px-4 py-3 text-[13px] font-normal leading-6',
        amber
          ? 'border-amber-200/60 bg-amber-50/60 text-amber-900'
          : 'border-hairline bg-mist text-slate',
      ].join(' ')}
    >
      {icon ? (
        <StickyNote
          aria-hidden="true"
          className="mr-1.5 inline h-[14px] w-[14px] text-amber-500"
        />
      ) : null}
      {children}
    </div>
  )
}

function VisitCard({ appointment, doctors, expanded, onToggle }) {
  const dateParts = formatDateParts(appointment.appointment_dt)
  const vitalsText = getVitalsText(appointment)
  const medications = normalizeStringArray(
    appointment.medications_prescribed || appointment.medications,
  )
  const precautions = normalizeStringArray(appointment.precautions)
  const medicalActivity = normalizeStringArray(
    appointment.medical_activity || appointment.medical_activities,
  )
  const postNotes = appointment.post_scheduling_notes || ''
  const additionalNotes = appointment.additional_notes || appointment.notes || ''

  return (
    <article className="mb-3 overflow-hidden rounded-card bg-canvas shadow-card">
      <button
        className="flex w-full cursor-pointer items-center justify-between gap-4 bg-mist px-5 py-3 text-left transition-colors hover:bg-brand-light/30"
        onClick={onToggle}
        type="button"
      >
        <div className="min-w-0">
          <p className="font-mono text-[13px] font-bold text-ink">
            {dateParts.date}
            {dateParts.time ? (
              <span className="font-medium text-slate"> · {dateParts.time}</span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-normal text-slate">
            {getAppointmentDoctorName(appointment, doctors)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge status="completed" />
          <ChevronDown
            aria-hidden="true"
            className={[
              'h-4 w-4 text-slate transition-transform duration-200',
              expanded ? 'rotate-180' : '',
            ].join(' ')}
          />
        </div>
      </button>

      {expanded ? (
        <div className="space-y-5 border-t border-hairline px-5 py-4 animate-fade-up">
          {vitalsText ? (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate">
                Vitals
              </h3>
              <span className="rounded bg-mist px-2 py-0.5 font-mono text-[12px] text-ink">
                {vitalsText}
              </span>
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate">
              Reason for Visit
            </h3>
            <p className="text-[14px] font-normal text-ink">
              {appointment.reason || 'Not recorded'}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate">
              Diagnosis
            </h3>
            <p
              className={[
                'text-[14px] font-normal',
                appointment.diagnosis ? 'text-ink' : 'italic text-slate/50',
              ].join(' ')}
            >
              {appointment.diagnosis || 'Not recorded'}
            </p>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate">
                Treatment Plan
              </h3>
              <p
                className={[
                  'text-[14px] font-normal',
                  appointment.treatment_plan ? 'text-ink' : 'italic text-slate/50',
                ].join(' ')}
              >
                {appointment.treatment_plan || 'Not recorded'}
              </p>
            </div>

            <ChipList
              empty="No medications prescribed"
              items={medications}
              tone="brand"
            />

            {precautions.length > 0 ? (
              <ul className="space-y-1 text-[13px] font-normal text-slate">
                {precautions.map((precaution) => (
                  <li key={precaution}>• {precaution}</li>
                ))}
              </ul>
            ) : null}

            {medicalActivity.length > 0 ? (
              <ul className="space-y-1 text-[13px] font-normal text-slate">
                {medicalActivity.map((activity) => (
                  <li key={activity}>• {activity}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate">
              Post-Scheduling Notes
            </h3>
            <NoteBlock amber icon>
              {postNotes || (
                <span className="italic text-slate/50">
                  No post-scheduling notes for this visit.
                </span>
              )}
            </NoteBlock>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate">
              Additional Notes
            </h3>
            <NoteBlock>
              {additionalNotes || (
                <span className="italic text-slate/50">No additional notes.</span>
              )}
            </NoteBlock>
          </section>
        </div>
      ) : null}
    </article>
  )
}

export function PatientView() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const outletContext = useOutletContext()
  const canEditPatient = !user || ['admin', 'receptionist'].includes(user.role)
  const canDeletePatient = !user || user.role === 'admin'
  const [patient, setPatient] = useState(null)
  const [completedVisits, setCompletedVisits] = useState([])
  const [upcomingAppointments, setUpcomingAppointments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [expandedVisits, setExpandedVisits] = useState(new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadPatientProfile = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    setNotFound(false)

    try {
      const [patientResponse, completedResponse, scheduledResponse, doctorsResponse] =
        await Promise.all([
          getPatient(id),
          getAppointments({
            patient: id,
            status: 'completed',
            ordering: '-appointment_dt',
          }),
          getAppointments({
            patient: id,
            status: 'scheduled',
            ordering: 'appointment_dt',
          }),
          getDoctors(),
        ])

      const visits = normalizeList(completedResponse)

      setPatient(patientResponse)
      setCompletedVisits(visits)
      setUpcomingAppointments(normalizeList(scheduledResponse))
      setDoctors(normalizeList(doctorsResponse))
      setExpandedVisits(new Set(visits[0] ? [getRecordId(visits[0])] : []))
    } catch (error) {
      if (error?.response?.status === 404) {
        setNotFound(true)
      } else {
        setLoadError(getBackendError(error, 'Patient profile could not be loaded.'))
      }
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    queueMicrotask(() => {
      loadPatientProfile()
    })
  }, [loadPatientProfile])

  useEffect(() => {
    outletContext?.setPageMeta?.(
      patient
        ? {
            title: getPatientName(patient),
            subtitle: 'Patient Profile',
          }
        : {
            title: 'Patient Profile',
            subtitle: 'Patient Profile',
          },
    )

    return () => outletContext?.clearPageMeta?.()
  }, [outletContext, patient])

  const age = getPatientAge(patient)
  const firstVisitDate = completedVisits.at(-1)?.appointment_dt
  const lastVisitDate = completedVisits[0]?.appointment_dt

  function toggleVisit(visitId) {
    setExpandedVisits((currentVisits) => {
      const nextVisits = new Set(currentVisits)

      if (nextVisits.has(visitId)) {
        nextVisits.delete(visitId)
      } else {
        nextVisits.add(visitId)
      }

      return nextVisits
    })
  }

  async function handleDeletePatient() {
    setIsDeleting(true)

    try {
      await deletePatient(id)
      toast.success('Patient deleted.')
      navigate('/patients', { replace: true })
    } catch (error) {
      toast.error(getBackendError(error, 'Patient could not be deleted.'))
    } finally {
      setIsDeleting(false)
    }
  }

  if (notFound) {
    return (
      <section className="mx-auto max-w-2xl rounded-card bg-canvas p-10 text-center shadow-card animate-fade-up">
        <h2 className="text-[18px] font-bold text-ink">Patient not found</h2>
        <p className="mt-2 text-[14px] font-normal text-slate">
          The patient record could not be found.
        </p>
        <Link
          className="mt-6 inline-flex items-center rounded-control border border-hairline bg-canvas px-4 py-2 text-sm font-semibold text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          to="/patients"
        >
          <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
          Back to patients
        </Link>
      </section>
    )
  }

  if (loadError) {
    return (
      <section className="rounded-card bg-canvas p-10 text-center shadow-card">
        <h2 className="text-[16px] font-semibold text-ink">
          Something went wrong
        </h2>
        <p className="mt-1 text-[14px] font-normal text-slate">{loadError}</p>
        <button
          className="mt-5 rounded-control border border-hairline bg-canvas px-4 py-2 text-sm font-semibold text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          onClick={loadPatientProfile}
          type="button"
        >
          Try again
        </button>
      </section>
    )
  }

  if (isLoading || !patient) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonRow index={index} key={index} variant="form" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          className="inline-flex items-center rounded-control bg-mist px-3 py-2 text-[13px] font-semibold text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          to="/patients"
        >
          <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
          Back
        </Link>
        <div className="flex gap-2">
          {canEditPatient ? (
            <button
              className="inline-flex h-10 items-center rounded-control border border-brand/20 bg-brand-light px-3 text-[13px] font-semibold text-brand transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              onClick={() => navigate(`/patients/${id}/edit`)}
              type="button"
            >
              <Edit aria-hidden="true" className="mr-2 h-4 w-4" />
              Edit
            </button>
          ) : null}
          {canDeletePatient ? (
            <button
              className="inline-flex h-10 items-center rounded-control border border-rose-200 bg-rose-50 px-3 text-[13px] font-semibold text-rose-600 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              onClick={() => setDeleteOpen(true)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded-card bg-canvas p-6 shadow-card">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={getPatientName(patient)} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-[22px] font-bold text-ink">
                  {getPatientName(patient)}
                </h1>
                {Number.isFinite(age) ? (
                  <span className="rounded-full bg-brand-light px-3 py-0.5 font-mono text-[12px] font-medium text-brand">
                    {age} yrs
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[13px] font-medium text-slate">
                {[patient.sex, patient.marital_status, patient.blood_group || 'Unknown']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:w-[520px]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">
                Phone
              </p>
              <p className="mt-1 font-mono text-[14px] font-medium text-ink">
                {patient.phone || '-'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">
                Address
              </p>
              <p className="mt-1 text-[13px] font-normal text-slate">
                {patient.address || '-'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">
                Weight / Height
              </p>
              <p className="mt-1 font-mono text-[13px] font-medium text-ink">
                {patient.weight_kg || '-'} kg · {patient.height_cm || '-'} cm
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">
                Physical Activity
              </p>
              <p className="mt-1 text-[13px] font-normal text-slate">
                {patient.physical_activity_level || '-'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate">
                Onboarded
              </p>
              <p className="mt-1 font-mono text-[12px] font-medium text-slate">
                {formatDate(patient.onboarding_date)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-card bg-canvas p-6 shadow-card">
        <h2 className="mb-4 text-[15px] font-semibold text-ink">
          Medical Background
        </h2>
        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate">
              Pre-existing Conditions
            </h3>
            <ChipList
              empty="None recorded"
              items={getPatientConditions(patient)}
              tone="rose"
            />
          </div>
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate">
              Known Allergies
            </h3>
            <ChipList
              empty="None recorded"
              items={getPatientAllergies(patient)}
              tone="amber"
            />
          </div>
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate">
              Current Medications
            </h3>
            <ChipList
              empty="None recorded"
              items={getPatientMedications(patient)}
              tone="brand"
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[18px] font-bold text-ink">Consultation History</h2>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-mist px-3 py-1 font-mono text-[12px] text-slate">
              First Visit: {formatDate(firstVisitDate)}
            </span>
            <span className="rounded-full bg-mist px-3 py-1 font-mono text-[12px] text-slate">
              Last Visit: {formatDate(lastVisitDate)}
            </span>
          </div>
        </div>

        {completedVisits.length > 0 ? (
          completedVisits.map((appointment) => {
            const visitId = getRecordId(appointment)

            return (
              <VisitCard
                appointment={appointment}
                doctors={doctors}
                expanded={expandedVisits.has(visitId)}
                key={visitId}
                onToggle={() => toggleVisit(visitId)}
              />
            )
          })
        ) : (
          <section className="rounded-card bg-canvas p-8 text-center shadow-card">
            <p className="text-[14px] font-medium text-slate">
              No completed consultations recorded.
            </p>
          </section>
        )}
      </section>

      <section className="rounded-card bg-canvas p-6 shadow-card">
        <h2 className="mb-4 text-[15px] font-semibold text-ink">
          Upcoming Appointments
        </h2>
        {upcomingAppointments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="border-b border-hairline bg-mist">
                <tr>
                  {['Date & Time', 'Doctor', 'Reason', 'Status', 'Payment'].map(
                    (header) => (
                      <th
                        className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate"
                        key={header}
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {upcomingAppointments.map((appointment) => (
                  <tr className="border-b border-hairline last:border-0" key={getRecordId(appointment)}>
                    <td className="px-4 py-3 font-mono text-[12px] font-medium text-ink">
                      {formatDateTime(appointment.appointment_dt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-normal text-ink">
                      {getAppointmentDoctorName(appointment, doctors)}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-normal text-slate">
                      {appointment.reason || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={appointment.status || 'scheduled'} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentBadge status={appointment.payment_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[14px] font-medium text-slate">
            No upcoming appointments
          </p>
        )}
      </section>

      {deleteOpen ? (
        <ConfirmationModal
          body={
            <>
              This will permanently delete{' '}
              <span className="font-semibold text-ink">{getPatientName(patient)}</span>.
            </>
          }
          confirmLabel="Delete Patient"
          isLoading={isDeleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDeletePatient}
          title="Delete patient?"
        />
      ) : null}
    </div>
  )
}

export default PatientView
