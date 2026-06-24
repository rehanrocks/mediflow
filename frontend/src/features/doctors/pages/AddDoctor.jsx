/* src/features/doctors/pages/AddDoctor.jsx - Add new doctor form. */
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import DoctorFormFields from '@features/doctors/components/DoctorFormFields'
import { useToast } from '@shared/components/Toast'
import { useAuth } from '@shared/context/AuthContext'
import { canAddDoctor } from '@shared/lib/permissions'
import { getBackendError } from '@shared/lib/records'
import { validatePhone } from '@shared/lib/validation'
import { createDoctor } from '@shared/services/api'

const INITIAL_FORM_DATA = {
  full_name: '',
  email: '',
  phone: '',
  qualification: '',
  specializations: [],
  experience_years: 0,
  shift_start: '09:00',
  shift_end: '17:00',
  status: 'active',
  join_date: new Date().toISOString().split('T')[0],
}

const TOUCHED_ALL = {
  email: true,
  experience_years: true,
  full_name: true,
  join_date: true,
  phone: true,
  qualification: true,
  shift_end: true,
  shift_start: true,
  specializations: true,
  status: true,
}

function validateDoctorForm(data) {
  const errors = {}
  const trimmedName = String(data.full_name || '').trim()
  const trimmedEmail = String(data.email || '').trim()
  const phoneError = validatePhone(data.phone)
  const experience = Number(data.experience_years)

  if (trimmedName.length < 2) {
    errors.full_name = 'Name must be at least 2 characters'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Please enter a valid email'
  }

  if (phoneError) {
    errors.phone = phoneError
  }

  if (!String(data.qualification || '').trim()) {
    errors.qualification = 'Qualification is required'
  }

  if (!data.specializations?.length) {
    errors.specializations = 'At least one specialization is required'
  }

  if (!Number.isFinite(experience)) {
    errors.experience_years = 'Experience is required'
  } else if (experience < 0) {
    errors.experience_years = 'Cannot be negative'
  }

  if (!data.shift_start) {
    errors.shift_start = 'Shift start time is required'
  }

  if (!data.shift_end) {
    errors.shift_end = 'Shift end time is required'
  }

  if (data.shift_start && data.shift_end && data.shift_end <= data.shift_start) {
    errors.shift_end = 'End time must be after start time'
  }

  if (!data.status) {
    errors.status = 'Status is required'
  }

  if (!data.join_date) {
    errors.join_date = 'Join date is required'
  } else if (data.join_date > new Date().toISOString().split('T')[0]) {
    errors.join_date = 'Join date cannot be in the future'
  }

  return errors
}

function prepareDoctorPayload(data) {
  return {
    ...data,
    email: String(data.email || '').trim(),
    experience_years: Number(data.experience_years),
    full_name: String(data.full_name || '').trim(),
    phone: String(data.phone || '').trim(),
    qualification: String(data.qualification || '').trim(),
    specializations: data.specializations.map((item) => item.trim()),
  }
}

export function AddDoctor() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [data, setData] = useState(INITIAL_FORM_DATA)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!canAddDoctor(user)) {
      navigate('/not-available', { replace: true })
    }
  }, [navigate, user])

  function handleChange(event) {
    const { name, value } = event.target
    setData((currentData) => ({
      ...currentData,
      [name]: value,
    }))

    if (errors[name]) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        [name]: '',
      }))
    }
  }

  function handleBlur(event) {
    const { name } = event.target
    setTouched((currentTouched) => ({
      ...currentTouched,
      [name]: true,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = validateDoctorForm(data)
    setTouched(TOUCHED_ALL)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const response = await createDoctor(prepareDoctorPayload(data))
      toast.success('Doctor added')
      navigate(`/doctors/${response.id}`)
    } catch (error) {
      toast.error(getBackendError(error, 'Doctor could not be created.'))
      setErrors(error?.response?.data || { general: 'Doctor could not be created.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <div className="mb-6 flex items-center gap-3">
        <button
          className="rounded-control p-2 text-slate transition hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          onClick={() => navigate('/doctors')}
          type="button"
        >
          <span className="sr-only">Back to doctors</span>
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-[28px] font-bold text-ink">Add Doctor</h1>
          <p className="mt-0.5 text-[13px] text-slate">
            Add a new doctor to the clinical team
          </p>
        </div>
      </div>

      <form
        className="space-y-6 rounded-card bg-canvas p-6 shadow-card"
        noValidate
        onSubmit={handleSubmit}
      >
        <DoctorFormFields
          data={data}
          errors={errors}
          onBlur={handleBlur}
          onChange={handleChange}
          touched={touched}
        />

        <div className="flex gap-3 pt-4">
          <button
            className="flex-1 rounded-control border border-hairline px-4 py-2.5 text-[13px] font-medium text-slate transition hover:bg-mist hover:text-ink"
            onClick={() => navigate('/doctors')}
            type="button"
          >
            Cancel
          </button>
          <button
            className="flex-1 rounded-control bg-brand px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Adding...' : 'Add Doctor'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddDoctor
