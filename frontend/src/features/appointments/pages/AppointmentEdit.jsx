/* src/features/appointments/pages/AppointmentEdit.jsx - Route-based appointment edit form. */
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import AppointmentFields, {
  EMPTY_APPOINTMENT_FORM,
  getAppointmentFormDefaults,
  toAppointmentPayload,
} from '../components/AppointmentFields'
import { ErrorBanner, LoadingSpinner } from '@shared/components/FormPrimitives'
import PatientSummaryPanel from '@features/patients/components/PatientSummaryPanel'
import SkeletonRow from '@shared/components/SkeletonRow'
import { useToast } from '@shared/components/Toast'
import { usePermission } from '@shared/lib/usePermission'
import {
  getAppointmentPatientId,
  getBackendError,
  getPaymentStatus,
  getRecordId,
  normalizeList,
} from '@shared/lib/records'
import {
  getAppointment,
  getDoctors,
  getPatient,
  updateAppointment,
} from '@shared/services/api'

function getEmbeddedAppointmentPatient(appointment) {
  return typeof appointment?.patient === 'object' ? appointment.patient : null
}

export function AppointmentEdit() {
  const { id } = useParams()
  const { canWrite } = usePermission()
  const toast = useToast()
  const navigate = useNavigate()
  const [appointment, setAppointment] = useState(null)
  const [patient, setPatient] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [formError, setFormError] = useState('')
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm({
    defaultValues: EMPTY_APPOINTMENT_FORM,
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  })

  const loadAppointment = useCallback(async () => {
    setIsLoading(true)
    setNotFound(false)
    setFormError('')

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
      reset(getAppointmentFormDefaults(appointmentResponse))
    } catch (error) {
      if (error?.response?.status === 404) {
        setNotFound(true)
      } else {
        setFormError(getBackendError(error, 'Appointment could not be loaded.'))
      }
    } finally {
      setIsLoading(false)
    }
  }, [id, reset])

  useEffect(() => {
    queueMicrotask(() => {
      loadAppointment()
    })
  }, [loadAppointment])

  if (!canWrite('appointments')) {
    return <Navigate replace to={`/appointments/${id}`} />
  }

  async function handleSave(values) {
    setFormError('')

    try {
      const payload = toAppointmentPayload(values)

      if (getPaymentStatus(appointment?.payment_status) === 'paid') {
        payload.payment_status = 'paid'
      }

      await updateAppointment(id, {
        ...payload,
        patient: getAppointmentPatientId(appointment),
      })
      toast.success('Appointment updated successfully.')
      navigate(`/appointments/${id}`, { replace: true })
    } catch (error) {
      const message = getBackendError(error, 'Appointment could not be updated.')
      setFormError(message)
      toast.error(message)
    }
  }

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

  return (
    <div className="mx-auto max-w-2xl">
      <form
        className="rounded-card bg-canvas p-8 shadow-card animate-fade-up"
        onSubmit={handleSubmit(handleSave)}
      >
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-ink">
              Edit Appointment
            </h1>
            <p className="mt-1 text-[14px] font-normal text-slate">
              Update visit details and payment status
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-control bg-mist px-3 text-[13px] font-semibold text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            to={`/appointments/${id}`}
          >
            <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
            Back
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-5">
            {Array.from({ length: 7 }).map((_, index) => (
              <SkeletonRow index={index} key={index} variant="form" />
            ))}
          </div>
        ) : (
          <>
            <PatientSummaryPanel
              link={patient ? `/patients/${getRecordId(patient)}` : ''}
              patient={patient}
            />

            <div className="mt-8">
              <AppointmentFields
                doctors={doctors}
                errors={errors}
                lockPaid={getPaymentStatus(appointment?.payment_status) === 'paid'}
                register={register}
                requireFuture={false}
                setValue={setValue}
                watch={watch}
              />
            </div>

            <ErrorBanner message={formError} />

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-control bg-mist px-4 py-2.5 text-[14px] font-medium text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                onClick={() => navigate(`/appointments/${id}`)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary-button inline-flex min-w-[150px] items-center justify-center rounded-control bg-brand px-4 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <LoadingSpinner light />
                ) : (
                  <>
                    <Save aria-hidden="true" className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

export default AppointmentEdit
