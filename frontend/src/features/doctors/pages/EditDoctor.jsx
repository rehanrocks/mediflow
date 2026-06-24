/* src/features/doctors/pages/EditDoctor.jsx - Edit existing doctor. */
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import DoctorFormFields from '@features/doctors/components/DoctorFormFields'
import SkeletonRow from '@shared/components/SkeletonRow'
import { useToast } from '@shared/components/Toast'
import { getBackendError } from '@shared/lib/records'
import { usePermission } from '@shared/lib/usePermission'
import { validatePhone } from '@shared/lib/validation'
import { getDoctorById, updateDoctor } from '@shared/services/api'

const TOUCHED_ALL = {
  email: true,
  experience_years: true,
  first_name: true,
  join_date: true,
  last_name: true,
  phone: true,
  qualifications: true,
  shift_end: true,
  shift_start: true,
  specializations: true,
  status: true,
}

function validateDoctorForm(data) {
  const errors = {}
  const firstName = String(data.first_name || '').trim()
  const lastName = String(data.last_name || '').trim()
  const trimmedEmail = String(data.email || '').trim()
  const phoneError = validatePhone(data.phone)
  const experience = Number(data.experience_years)

  if (!firstName) {
    errors.first_name = 'First name is required'
  }

  if (!lastName) {
    errors.last_name = 'Last name is required'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Please enter a valid email'
  }

  if (phoneError) {
    errors.phone = phoneError
  }

  if (!data.qualifications?.length) {
    errors.qualifications = 'At least one qualification is required'
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

  if (data.shift_start && data.shift_end && data.shift_end === data.shift_start) {
    errors.shift_end = 'End time must be different from start time'
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

function mapDoctorToForm(doctor) {
  const fullNameParts = String(doctor.full_name || '').trim().split(' ').filter(Boolean)

  return {
    email: doctor.email || '',
    experience_years: doctor.experience_years ?? 0,
    first_name: doctor.first_name || fullNameParts[0] || '',
    last_name: doctor.last_name || fullNameParts.slice(1).join(' ') || '',
    join_date: doctor.join_date || '',
    phone: doctor.phone || '',
    qualifications: Array.isArray(doctor.qualifications)
      ? doctor.qualifications
      : String(doctor.qualification || '')
          .split(',')
          .map((name, index) => ({
            id: `legacy-${index}-${name.trim()}`,
            name: name.trim(),
          }))
          .filter((qualification) => qualification.name),
    shift_end: doctor.shift_end || '17:00',
    shift_start: doctor.shift_start || '09:00',
    specializations: doctor.specializations || [],
    status: doctor.status || 'active',
  }
}

function prepareDoctorPayload(data) {
  return {
    email: String(data.email || '').trim(),
    experience_years: Number(data.experience_years),
    first_name: String(data.first_name || '').trim(),
    last_name: String(data.last_name || '').trim(),
    phone: String(data.phone || '').trim(),
    qualification_ids: data.qualifications
      .map((item) => item.id)
      .filter((id) => Number.isFinite(Number(id)))
      .map(Number),
    specializations: data.specializations.map((item) => item.trim()),
    shift_end: data.shift_end,
    shift_start: data.shift_start,
    status: data.status,
    join_date: data.join_date,
  }
}

export function EditDoctor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const toast = useToast()
  const { isAdmin } = usePermission()
  const [data, setData] = useState(null)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isAdmin) {
      navigate(`/doctors/${id}`, { replace: true })
    }
  }, [id, isAdmin, navigate])

  useEffect(() => {
    let mounted = true

    async function fetchDoctor() {
      setIsLoading(true)

      try {
        const doctorData = await getDoctorById(id)

        if (mounted) {
          setData(mapDoctorToForm(doctorData))
        }
      } catch (error) {
        if (mounted) {
          toast.error(getBackendError(error, 'Doctor could not be loaded.'))
          setData(null)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchDoctor()

    return () => {
      mounted = false
    }
  }, [id, toast])

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
      await updateDoctor(id, prepareDoctorPayload(data))
      toast.success('Changes saved')
      navigate(`/doctors/${id}`)
    } catch (error) {
      toast.error(getBackendError(error, 'Doctor could not be updated.'))
      setErrors(error?.response?.data || { general: 'Doctor could not be updated.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-card bg-canvas p-6 shadow-card">
          {Array.from({ length: 9 }).map((_, index) => (
            <SkeletonRow index={index} key={index} variant="form" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl rounded-card bg-canvas p-10 text-center shadow-card">
        <p className="text-[15px] font-semibold text-ink">Doctor not found</p>
        <button
          className="mt-4 text-sm font-semibold text-brand transition hover:text-brand-dark"
          onClick={() => navigate('/doctors')}
          type="button"
        >
          Back to doctors
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <div className="mb-6 flex items-center gap-3">
        <button
          className="rounded-control p-2 text-slate transition hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          onClick={() => navigate(`/doctors/${id}`)}
          type="button"
        >
          <span className="sr-only">Back to doctor</span>
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-[28px] font-bold text-ink">Edit Doctor</h1>
          <p className="mt-0.5 text-[13px] text-slate">
            Update doctor information
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
            onClick={() => navigate(`/doctors/${id}`)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="flex-1 rounded-control bg-brand px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditDoctor
