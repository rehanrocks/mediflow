/* src/features/staff/pages/AddStaff.jsx - Add new staff member form. */
import { useEffect, useState } from 'react'
import { ChevronLeft, UserPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import StaffFormFields from '@features/staff/components/StaffFormFields'
import {
  INITIAL_STAFF_FORM_DATA,
  TOUCHED_ALL_STAFF_FIELDS,
  prepareStaffPayload,
  validateStaffForm,
} from '@features/staff/lib/staffForm'
import { ErrorBanner, LoadingSpinner } from '@shared/components/FormPrimitives'
import { useToast } from '@shared/components/Toast'
import { getBackendError } from '@shared/lib/records'
import { usePermission } from '@shared/lib/usePermission'
import { createStaff, getRoleNames } from '@shared/services/api'

function normalizeRoleOptions(response) {
  if (Array.isArray(response?.results)) {
    return response.results
  }

  if (Array.isArray(response)) {
    return response
  }

  return []
}

function canonicalizeRoleName(roleName, roleOptions) {
  const trimmedRoleName = String(roleName || '').trim()

  if (!Array.isArray(roleOptions)) {
    return trimmedRoleName
  }

  return (
    roleOptions.find(
      (role) =>
        String(role.name || '').trim().toLowerCase() ===
        trimmedRoleName.toLowerCase(),
    )?.name || trimmedRoleName
  )
}

export function AddStaff() {
  const navigate = useNavigate()
  const toast = useToast()
  const { canWrite } = usePermission()
  const [data, setData] = useState(INITIAL_STAFF_FORM_DATA)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [roleOptions, setRoleOptions] = useState(null)
  const [roleOptionsFailed, setRoleOptionsFailed] = useState(false)

  useEffect(() => {
    if (!canWrite('staff')) {
      navigate('/not-available', { replace: true })
    }
  }, [canWrite, navigate])

  useEffect(() => {
    let mounted = true

    async function loadRoleOptions() {
      try {
        const response = await getRoleNames()

        if (mounted) {
          setRoleOptions(normalizeRoleOptions(response))
          setRoleOptionsFailed(false)
        }
      } catch {
        if (mounted) {
          setRoleOptions([])
          setRoleOptionsFailed(true)
        }
      }
    }

    loadRoleOptions()

    return () => {
      mounted = false
    }
  }, [])

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
      const payload = prepareStaffPayload({
        ...data,
        role: canonicalizeRoleName(data.role, roleOptions),
      })
      const response = await createStaff(payload)

      if (response?.role_created) {
        toast.custom(
          <>
            Staff member added. New role "{payload.role}" saved to Access Control.{' '}
            <Link className="font-semibold underline" to="/access-control">
              Go to Access Control
            </Link>{' '}
            to set permissions for this role.
          </>,
        )
      } else {
        toast.success('Staff member added')
      }

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
            roleOptions={roleOptions}
            roleOptionsFailed={roleOptionsFailed}
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
