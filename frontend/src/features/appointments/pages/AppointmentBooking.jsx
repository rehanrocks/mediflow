/* src/features/appointments/pages/AppointmentBooking.jsx - Full-page appointment booking flow. */
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarCheck, Search, UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import AppointmentFields, {
  EMPTY_APPOINTMENT_FORM,
  toAppointmentPayload,
} from '../components/AppointmentFields'
import Avatar from '@shared/components/Avatar'
import { ErrorBanner, LoadingSpinner } from '@shared/components/FormPrimitives'
import {
  EMPTY_PATIENT_FORM,
  PatientFields,
  toPatientPayload,
  validateUniquePatientPhone,
} from '@features/patients/components/PatientFields'
import PatientSummaryPanel from '@features/patients/components/PatientSummaryPanel'
import { useToast } from '@shared/components/Toast'
import { useAuth } from '@shared/context/AuthContext'
import { canBookAppointment } from '@shared/lib/permissions'
import {
  getBackendError,
  getPatientAge,
  getPatientName,
  getRecordId,
  normalizeList,
} from '@shared/lib/records'
import {
  bookAppointment,
  createPatient,
  getDoctors,
  getPatients,
} from '@shared/services/api'

const PATIENT_MODE_OPTIONS = [
  {
    label: 'Existing Patient',
    value: 'existing',
  },
  {
    label: 'New Patient',
    value: 'new',
  },
]

export function AppointmentBooking() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [patientMode, setPatientMode] = useState('existing')
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [isSearchingPatients, setIsSearchingPatients] = useState(true)
  const [doctors, setDoctors] = useState([])
  const [formError, setFormError] = useState('')
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)

  const appointmentForm = useForm({
    defaultValues: EMPTY_APPOINTMENT_FORM,
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  })
  const patientForm = useForm({
    defaultValues: EMPTY_PATIENT_FORM,
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  })

  useEffect(() => {
    let isMounted = true

    async function loadDoctors() {
      try {
        const response = await getDoctors()

        if (isMounted) {
          setDoctors(normalizeList(response))
        }
      } catch {
        if (isMounted) {
          setDoctors([])
        }
      }
    }

    loadDoctors()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (patientMode !== 'existing' || selectedPatient) {
      return undefined
    }

    const query = patientSearch.trim()
    let isMounted = true

    const debounceId = window.setTimeout(async () => {
      setIsSearchingPatients(true)

      try {
        const response = await getPatients(query ? { search: query } : {})

        if (isMounted) {
          setPatientResults(normalizeList(response))
        }
      } catch {
        if (isMounted) {
          setPatientResults([])
        }
      } finally {
        if (isMounted) {
          setIsSearchingPatients(false)
        }
      }
    }, query ? 300 : 0)

    return () => {
      isMounted = false
      window.clearTimeout(debounceId)
    }
  }, [patientMode, patientSearch, selectedPatient])

  const hasPatientResults = useMemo(
    () => patientMode === 'existing' && !selectedPatient && patientResults.length > 0,
    [patientMode, patientResults.length, selectedPatient],
  )

  if (!canBookAppointment(user)) {
    return <Navigate replace to="/appointments" />
  }

  async function handleConfirmBooking(values) {
    setFormError('')
    setIsSubmittingBooking(true)

    try {
      let patientId = getRecordId(selectedPatient)

      if (patientMode === 'existing' && !patientId) {
        setFormError('Select an existing patient before booking.')
        return
      }

      if (patientMode === 'new') {
        const validPatient = await patientForm.trigger()

        if (!validPatient) {
          setFormError('Complete the patient registration fields before booking.')
          return
        }

        const patientValues = patientForm.getValues()
        const duplicatePhoneError = await validateUniquePatientPhone(
          patientValues.phone,
        )

        if (duplicatePhoneError) {
          patientForm.setError('phone', {
            type: 'manual',
            message: duplicatePhoneError,
          })
          setFormError(duplicatePhoneError)
          return
        }

        const createdPatient = await createPatient(toPatientPayload(patientValues))
        patientId = getRecordId(createdPatient)
      }

      await bookAppointment({
        ...toAppointmentPayload(values),
        patient: patientId,
      })

      toast.success('Appointment booked successfully')
      navigate('/appointments', { replace: true })
    } catch (error) {
      const message = getBackendError(error, 'Appointment could not be booked.')
      setFormError(message)
      toast.error(message)
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  function selectPatient(patient) {
    setSelectedPatient(patient)
    setPatientSearch(`${getPatientName(patient)} ${patient.phone || ''}`.trim())
    setPatientResults([])
    setIsSearchingPatients(false)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <form
        className="rounded-card bg-canvas p-8 shadow-card animate-fade-up"
        onSubmit={appointmentForm.handleSubmit(handleConfirmBooking)}
      >
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-ink">Book Appointment</h1>
            <p className="mt-1 text-[14px] font-normal text-slate">
              Register a new visit for a patient
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-control bg-mist px-3 text-[13px] font-semibold text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            to="/appointments"
          >
            <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
            Back
          </Link>
        </div>

        <section className="mb-8">
          <div className="inline-flex rounded-xl border border-hairline bg-mist p-1">
            {PATIENT_MODE_OPTIONS.map((option) => {
              const active = patientMode === option.value

              return (
                <button
                  className={[
                    'rounded-lg px-4 py-2 text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                    active
                      ? 'bg-canvas font-semibold text-ink shadow-sm'
                      : 'font-medium text-slate hover:text-ink',
                  ].join(' ')}
                  key={option.value}
                  onClick={() => {
                    setPatientMode(option.value)
                    setFormError('')
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          {patientMode === 'existing' ? (
            <div className="mt-5">
              <label className="relative block">
                <span className="sr-only">Search existing patients</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate"
                />
                <input
                  className="h-11 w-full rounded-control border border-hairline bg-mist/50 pl-9 pr-10 text-[14px] font-normal text-ink outline-none transition-all focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/25"
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setSelectedPatient(null)
                    setPatientSearch(nextValue)

                    if (!nextValue.trim()) {
                      setPatientResults([])
                    } else {
                      setIsSearchingPatients(true)
                    }
                  }}
                  placeholder="Search by name or phone number..."
                  type="search"
                  value={patientSearch}
                />
                {isSearchingPatients ? (
                  <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
                ) : null}
              </label>

              {hasPatientResults ? (
                <div className="mt-2 overflow-hidden rounded-control border border-hairline bg-canvas shadow-card animate-scale-in">
                  <div className="border-b border-hairline bg-mist px-4 py-2">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-slate">
                      {patientSearch.trim()
                        ? 'Matching Patients'
                        : 'Existing Patients'}
                    </p>
                  </div>
                  {patientResults.map((patient) => {
                    const age = getPatientAge(patient)

                    return (
                      <button
                        className="flex w-full items-center gap-3 border-b border-hairline px-4 py-3 text-left transition hover:bg-brand-light/40 last:border-0"
                        key={getRecordId(patient)}
                        onClick={() => selectPatient(patient)}
                        type="button"
                      >
                        <Avatar name={getPatientName(patient)} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-ink">
                            {getPatientName(patient)}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[12px] font-medium text-slate">
                            {patient.phone || '-'}
                          </p>
                        </div>
                        <span className="font-mono text-[12px] font-medium text-slate">
                          {Number.isFinite(age) ? `${age} yrs` : '-'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : patientMode === 'existing' &&
                !selectedPatient &&
                !isSearchingPatients ? (
                <div className="mt-2 rounded-control border border-dashed border-hairline bg-mist/50 px-4 py-5 text-center">
                  <p className="text-[13px] font-medium text-slate">
                    No existing patients found.
                  </p>
                </div>
              ) : null}

              <PatientSummaryPanel patient={selectedPatient} />
            </div>
          ) : (
            <div className="mt-6 rounded-card border border-hairline bg-mist/40 p-5">
              <div className="mb-5 flex items-center gap-2 text-[14px] font-semibold text-ink">
                <UserPlus aria-hidden="true" className="h-4 w-4 text-brand" />
                New Patient Details
              </div>
              <PatientFields
                clearErrors={patientForm.clearErrors}
                currentPatientId={null}
                errors={patientForm.formState.errors}
                register={patientForm.register}
                setError={patientForm.setError}
                setValue={patientForm.setValue}
                watch={patientForm.watch}
              />
            </div>
          )}
        </section>

        <AppointmentFields
          doctors={doctors}
          errors={appointmentForm.formState.errors}
          register={appointmentForm.register}
          requireFuture
          setValue={appointmentForm.setValue}
          watch={appointmentForm.watch}
        />

        <ErrorBanner message={formError} />

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-control bg-mist px-4 py-2.5 text-[14px] font-medium text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            onClick={() => navigate('/appointments')}
            type="button"
          >
            Cancel
          </button>
          <button
            className="primary-button inline-flex min-w-[165px] items-center justify-center rounded-control bg-brand px-4 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmittingBooking}
            type="submit"
          >
            {isSubmittingBooking ? (
              <LoadingSpinner light />
            ) : (
              <>
                <CalendarCheck aria-hidden="true" className="mr-2 h-4 w-4" />
                Confirm Booking
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AppointmentBooking
