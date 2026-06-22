/* src/pages/PatientFormPage.jsx - Route-based add/edit patient form. */
import { useEffect, useState } from 'react'
import { ArrowLeft, Save, UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import {
  EMPTY_PATIENT_FORM,
  getPatientFormDefaults,
  PatientFields,
  toPatientPayload,
} from '../components/PatientFields'
import { ErrorBanner, LoadingSpinner } from '../components/FormPrimitives'
import SkeletonRow from '../components/SkeletonRow'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { getBackendError, getPatientName, getRecordId } from '../lib/records'
import { createPatient, getPatient, updatePatient } from '../services/api'

export function PatientFormPage({ mode = 'add' }) {
  const isEdit = mode === 'edit'
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)
  const [formError, setFormError] = useState('')
  const [patient, setPatient] = useState(null)
  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = useForm({
    defaultValues: EMPTY_PATIENT_FORM,
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  })

  useEffect(() => {
    if (!isEdit) {
      return undefined
    }

    let isMounted = true

    async function loadPatient() {
      setIsLoading(true)
      setNotFound(false)
      setFormError('')

      try {
        const response = await getPatient(id)

        if (!isMounted) {
          return
        }

        setPatient(response)
        reset(getPatientFormDefaults(response))
      } catch (error) {
        if (!isMounted) {
          return
        }

        if (error?.response?.status === 404) {
          setNotFound(true)
        } else {
          setFormError(getBackendError(error, 'Patient could not be loaded.'))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadPatient()

    return () => {
      isMounted = false
    }
  }, [id, isEdit, reset])

  if (user?.role === 'doctor') {
    return <Navigate replace to={isEdit ? `/patients/${id}` : '/patients'} />
  }

  async function handleSave(values) {
    setFormError('')

    try {
      const payload = toPatientPayload(values)
      const response = isEdit
        ? await updatePatient(id, payload)
        : await createPatient(payload)
      const patientId = getRecordId(response) || id

      toast.success(isEdit ? 'Patient updated successfully.' : 'Patient added successfully.')
      navigate(`/patients/${patientId}`, { replace: true })
    } catch (error) {
      const message = getBackendError(
        error,
        isEdit ? 'Patient could not be updated.' : 'Patient could not be added.',
      )
      setFormError(message)
      toast.error(message)
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

  return (
    <div className="mx-auto max-w-2xl">
      <form
        className="rounded-card bg-canvas p-8 shadow-card animate-fade-up"
        onSubmit={handleSubmit(handleSave)}
      >
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-ink">
              {isEdit ? 'Edit Patient' : 'Register New Patient'}
            </h1>
            <p className="mt-1 text-[14px] font-normal text-slate">
              {isEdit
                ? `Update details for ${getPatientName(patient, 'this patient')}`
                : 'Fill in patient details to onboard them into the system'}
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-control bg-mist px-3 text-[13px] font-semibold text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            to={isEdit ? `/patients/${id}` : '/patients'}
          >
            <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
            Back
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-5">
            {Array.from({ length: 9 }).map((_, index) => (
              <SkeletonRow index={index} key={index} variant="form" />
            ))}
          </div>
        ) : (
          <>
            <PatientFields
              clearErrors={clearErrors}
              currentPatientId={isEdit ? id : null}
              errors={errors}
              register={register}
              setError={setError}
              setValue={setValue}
              watch={watch}
            />

            <ErrorBanner message={formError} />

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-control bg-mist px-4 py-2.5 text-[14px] font-medium text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                onClick={() => navigate(isEdit ? `/patients/${id}` : '/patients')}
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
                ) : isEdit ? (
                  <>
                    <Save aria-hidden="true" className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
                    Register Patient
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

export default PatientFormPage
