/* src/features/staff/pages/EditStaff.jsx - Edit existing staff member. */
import { useEffect, useState } from 'react'
import { ChevronLeft, Pencil } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import StaffFormFields from '@features/staff/components/StaffFormFields'
import {
  TOUCHED_ALL_STAFF_FIELDS,
  mapStaffToForm,
  prepareStaffPayload,
  validateStaffForm,
} from '@features/staff/lib/staffForm'
import { ErrorBanner, LoadingSpinner } from '@shared/components/FormPrimitives'
import SkeletonRow from '@shared/components/SkeletonRow'
import { useToast } from '@shared/components/Toast'
import { useAuth } from '@shared/context/AuthContext'
import { canManageStaff } from '@shared/lib/permissions'
import { getBackendError } from '@shared/lib/records'
import { getStaffCreatedDateError } from '@shared/lib/staffUtils'
import { validatePhone } from '@shared/lib/validation'
import { getList, getStaff, getStaffById, updateStaff } from '@shared/services/api'

const PHONE_DUPLICATE_ERROR = 'Phone already registered to another staff member'

function mergeCreatedDateError(errors, data, createdAt) {
  const createdDateError = getStaffCreatedDateError(
    data.joining_date,
    createdAt,
  )

  if (!createdDateError) {
    return errors
  }

  return {
    ...errors,
    joining_date: createdDateError,
  }
}

export function EditStaff() {
  const navigate = useNavigate()
  const { id } = useParams()
  const toast = useToast()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [createdAt, setCreatedAt] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!canManageStaff(user)) {
      navigate('/not-available', { replace: true })
    }
  }, [id, navigate, user])

  useEffect(() => {
    let mounted = true

    async function fetchStaffMember() {
      setIsLoading(true)

      try {
        const staffMember = await getStaffById(id)

        if (mounted) {
          setData(mapStaffToForm(staffMember))
          setCreatedAt(staffMember.created_at || '')
        }
      } catch (error) {
        if (mounted) {
          if (error?.response?.status !== 404) {
            toast.error(getBackendError(error, 'Staff member could not be loaded.'))
          }
          setData(null)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchStaffMember()

    return () => {
      mounted = false
    }
  }, [id, toast])

  function handleChange(event) {
    const { name, value } = event.target
    const nextData = {
      ...data,
      [name]: value,
    }
    const nextErrors = mergeCreatedDateError(
      validateStaffForm(nextData),
      nextData,
      createdAt,
    )

    if (name !== 'phone' && errors.phone === PHONE_DUPLICATE_ERROR) {
      nextErrors.phone = PHONE_DUPLICATE_ERROR
    }

    setGeneralError('')
    setData(nextData)
    setTouched((currentTouched) => ({
      ...currentTouched,
      [name]: true,
      ...(name === 'age' || name === 'joining_date'
        ? { age: true, joining_date: true }
        : {}),
    }))
    setErrors(nextErrors)
  }

  async function handleBlur(event) {
    const { name } = event.target
    setTouched((currentTouched) => ({
      ...currentTouched,
      [name]: true,
      ...(name === 'age' || name === 'joining_date'
        ? { age: true, joining_date: true }
        : {}),
    }))

    const nextErrors = mergeCreatedDateError(
      validateStaffForm(data),
      data,
      createdAt,
    )

    if (name !== 'phone' || validatePhone(data?.phone)) {
      setErrors(nextErrors)
      return
    }

    try {
      const response = await getStaff({ phone: String(data.phone || '').trim() })
      const duplicate = getList(response).find(
        (staffMember) => String(staffMember.id) !== String(id),
      )

      setErrors({
        ...nextErrors,
        phone: duplicate ? PHONE_DUPLICATE_ERROR : nextErrors.phone || '',
      })
    } catch {
      setErrors(nextErrors)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = mergeCreatedDateError(
      validateStaffForm(data),
      data,
      createdAt,
    )
    setTouched(TOUCHED_ALL_STAFF_FIELDS)

    if (errors.phone === PHONE_DUPLICATE_ERROR) {
      nextErrors.phone = PHONE_DUPLICATE_ERROR
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setIsSubmitting(true)

    try {
      await updateStaff(id, prepareStaffPayload(data))
      toast.success('Changes saved')
      navigate(`/staff/${id}`)
    } catch (error) {
      const message = getBackendError(error, 'Staff member could not be updated.')
      toast.error(message)
      setGeneralError(message)
      setErrors(error?.response?.data || {})
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-card bg-canvas p-8 shadow-card">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonRow index={index} key={index} variant="form" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-xl rounded-card bg-canvas p-10 text-center shadow-card">
        <p className="text-[15px] font-semibold text-ink">Staff member not found</p>
        <button
          className="mt-4 text-sm font-semibold text-brand transition hover:text-brand-dark"
          onClick={() => navigate('/staff')}
          type="button"
        >
          Back to staff
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl animate-fade-up">
      <form
        className="overflow-hidden rounded-card border border-hairline/70 bg-canvas shadow-card"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="flex items-start gap-3 border-b border-hairline bg-mist/60 px-8 py-6">
          <button
            className="mt-0.5 rounded-control p-2 text-slate transition hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            onClick={() => navigate(`/staff/${id}`)}
            type="button"
          >
            <span className="sr-only">Back to staff member</span>
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand sm:flex">
              <Pencil aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold text-ink">Edit Staff Member</h1>
              <p className="mt-1 text-[14px] text-slate">
                Update staff member information
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-8 py-7">
          <StaffFormFields
            data={data}
            errors={errors}
            onBlur={handleBlur}
            onChange={handleChange}
            showStatus
            touched={touched}
          />

          <ErrorBanner message={generalError} />

          <div className="flex justify-end gap-3 border-t border-hairline pt-5">
            <button
              className="rounded-control border border-hairline px-4 py-2.5 text-[13px] font-medium text-slate transition hover:bg-mist hover:text-ink"
              onClick={() => navigate(`/staff/${id}`)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex min-w-[140px] items-center justify-center rounded-control bg-brand px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? <LoadingSpinner light /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default EditStaff
