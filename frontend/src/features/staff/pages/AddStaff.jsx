/* src/features/staff/pages/AddStaff.jsx - Add new staff member form. */
import { useEffect, useState } from 'react'
import { ChevronLeft, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import StaffFormFields from '@features/staff/components/StaffFormFields'
import {
  INITIAL_STAFF_FORM_DATA,
  TOUCHED_ALL_STAFF_FIELDS,
  prepareStaffPayload,
  validateStaffForm,
} from '@features/staff/lib/staffForm'
import { ErrorBanner, LoadingSpinner } from '@shared/components/FormPrimitives'
import { useToast } from '@shared/components/Toast'
import { useAuth } from '@shared/context/AuthContext'
import { canManageStaff } from '@shared/lib/permissions'
import { getBackendError } from '@shared/lib/records'
import { createStaff } from '@shared/services/api'

export function AddStaff() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [data, setData] = useState(INITIAL_STAFF_FORM_DATA)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!canManageStaff(user)) {
      navigate('/not-available', { replace: true })
    }
  }, [navigate, user])

  function handleChange(event) {
    const { name, value } = event.target
    const nextData = {
      ...data,
      [name]: value,
      status: 'active',
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
    setErrors(validateStaffForm(nextData))
  }

  function handleBlur(event) {
    const { name } = event.target
    setTouched((currentTouched) => ({
      ...currentTouched,
      [name]: true,
      ...(name === 'age' || name === 'joining_date'
        ? { age: true, joining_date: true }
        : {}),
    }))
    setErrors(validateStaffForm(data))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = validateStaffForm(data)
    setTouched(TOUCHED_ALL_STAFF_FIELDS)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const response = await createStaff(prepareStaffPayload(data))
      toast.success('Staff member added')
      navigate(`/staff/${response.id}`)
    } catch (error) {
      const message = getBackendError(error, 'Staff member could not be created.')
      toast.error(message)
      setGeneralError(message)
      setErrors(error?.response?.data || {})
    } finally {
      setIsSubmitting(false)
    }
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
            onClick={() => navigate('/staff')}
            type="button"
          >
            <span className="sr-only">Back to staff</span>
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand sm:flex">
              <UserPlus aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold text-ink">Add Staff Member</h1>
              <p className="mt-1 text-[14px] text-slate">
                Register a new clinic staff member
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
            showStatus={false}
            touched={touched}
          />

          <ErrorBanner message={generalError} />

          <div className="flex justify-end gap-3 border-t border-hairline pt-5">
            <button
              className="rounded-control border border-hairline px-4 py-2.5 text-[13px] font-medium text-slate transition hover:bg-mist hover:text-ink"
              onClick={() => navigate('/staff')}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex min-w-[160px] items-center justify-center rounded-control bg-brand px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? <LoadingSpinner light /> : 'Add Staff Member'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddStaff
