/* src/features/doctors/components/DoctorFormFields.jsx - Reusable doctor form fields. */
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { createQualification, getQualifications } from '@shared/services/api'

function FieldError({ children, tone = 'error' }) {
  if (!children) return null

  return (
    <p
      className={[
        'mt-1 text-[11px] font-normal',
        tone === 'warning' ? 'text-amber-600' : 'text-rose-600',
      ].join(' ')}
    >
      {children}
    </p>
  )
}

function Field({ children, error, label }) {
  return (
    <label className="block">
      <span
        className={[
          'mb-2 block text-[13px] font-medium',
          error ? 'text-rose-600' : 'text-ink',
        ].join(' ')}
      >
        {label}
      </span>
      {children}
      <FieldError>{error}</FieldError>
    </label>
  )
}

const INPUT_CLASS =
  'w-full rounded-control border border-hairline bg-mist px-3 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-slate/50 focus:border-brand'
const EMAIL_HELPER_TEXT = 'Login credentials will be sent to this email address.'

const SPECIALIZATION_OPTIONS = [
  'Cardiology',
  'Dentistry',
  'Dermatology',
  'ENT',
  'General Physician',
  'Gynecology',
  'Internal Medicine',
  'Neonatology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Sports Medicine',
]

export function DoctorFormFields({
  data,
  emailReadOnly = false,
  errors,
  onBlur,
  onChange,
  touched,
}) {
  const [specInput, setSpecInput] = useState('')
  const [qualInput, setQualInput] = useState('')
  const [qualLoading, setQualLoading] = useState(false)
  const [qualError, setQualError] = useState('')
  const [allQuals, setAllQuals] = useState([])
  const specInputRef = useRef(null)

  useEffect(() => {
    let mounted = true

    getQualifications()
      .then((response) => {
        if (mounted) {
          setAllQuals(Array.isArray(response) ? response : response?.results || [])
        }
      })
      .catch(() => {
        if (mounted) {
          setAllQuals([])
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  function addSpecialization(value) {
    const nextValue = String(value || '').trim()

    if (!nextValue) {
      return
    }

    if (
      !data.specializations.some(
        (specialization) =>
          specialization.toLowerCase() === nextValue.toLowerCase(),
      )
    ) {
      onChange({
        target: {
          name: 'specializations',
          value: [...data.specializations, nextValue],
        },
      })
    }

    setSpecInput('')
  }

  function handleSpecKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addSpecialization(specInput)
    }
  }

  function removeSpecialization(index) {
    onChange({
      target: {
        name: 'specializations',
        value: data.specializations.filter((_, currentIndex) => currentIndex !== index),
      },
    })
  }

  function handleSpecializationSelect(event) {
    const { value } = event.target

    if (!value) {
      return
    }

    if (value === 'other') {
      setSpecInput('')
      specInputRef.current?.focus()
      event.target.value = ''
      return
    }

    addSpecialization(value)
    event.target.value = ''
  }

  function emitQualifications(nextQualifications) {
    onChange({
      target: {
        name: 'qualifications',
        value: nextQualifications,
      },
    })
  }

  async function addQualification(value) {
    const trimmed = String(value || '').trim()

    if (!trimmed) {
      return
    }

    setQualError('')

    const existing = allQuals.find(
      (qualification) =>
        qualification.name.toLowerCase() === trimmed.toLowerCase(),
    )

    if (existing) {
      if (
        !data.qualifications.some(
          (qualification) =>
            qualification.id === existing.id ||
            qualification.name.toLowerCase() === existing.name.toLowerCase(),
        )
      ) {
        emitQualifications([...data.qualifications, existing])
      }
      setQualInput('')
      return
    }

    setQualLoading(true)

    try {
      const created = await createQualification(trimmed)
      setAllQuals((currentQuals) => [...currentQuals, created])
      emitQualifications([...data.qualifications, created])
      setQualInput('')
    } catch {
      setQualError('Could not save qualification. Please try again.')
    } finally {
      setQualLoading(false)
    }
  }

  function handleQualKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addQualification(qualInput)
    }
  }

  function removeQualification(id) {
    emitQualifications(
      data.qualifications.filter((qualification) => qualification.id !== id),
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field error={touched.first_name && errors.first_name} label="First Name *">
          <input
            className={INPUT_CLASS}
            name="first_name"
            onBlur={onBlur}
            onChange={onChange}
            placeholder="First name"
            type="text"
            value={data.first_name}
          />
        </Field>

        <Field error={touched.last_name && errors.last_name} label="Last Name *">
          <input
            className={INPUT_CLASS}
            name="last_name"
            onBlur={onBlur}
            onChange={onChange}
            placeholder="Last name"
            type="text"
            value={data.last_name}
          />
        </Field>
      </div>

      <Field error={touched.email && errors.email} label="Email *">
        <input
          className={[
            INPUT_CLASS,
            emailReadOnly ? 'cursor-not-allowed bg-mist text-slate' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          name="email"
          onBlur={onBlur}
          onChange={onChange}
          placeholder="name@clinic.com"
          readOnly={emailReadOnly}
          type="email"
          value={data.email}
        />
        <p className="mt-1 text-[11px] font-normal text-slate/60">
          {EMAIL_HELPER_TEXT}
        </p>
        {emailReadOnly ? (
          <FieldError tone="warning">
            Email cannot be changed after account creation.
          </FieldError>
        ) : null}
      </Field>

      <Field error={touched.phone && errors.phone} label="Phone *">
        <input
          className={INPUT_CLASS}
          name="phone"
          onBlur={onBlur}
          onChange={onChange}
          placeholder="+923001234567"
          type="tel"
          value={data.phone}
        />
      </Field>

      <div>
        <span
          className={[
            'mb-2 block text-[13px] font-medium',
            touched.qualifications && errors.qualifications
              ? 'text-rose-600'
              : 'text-ink',
          ].join(' ')}
        >
          Qualifications *
        </span>
        <div className="rounded-control border border-hairline bg-mist px-3 py-2.5">
          {data.qualifications.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {data.qualifications.map((qualification) => (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700"
                  key={qualification.id}
                >
                  {qualification.name}
                  <button
                    className="rounded-full transition hover:bg-violet-100"
                    onClick={() => removeQualification(qualification.id)}
                    type="button"
                  >
                    <span className="sr-only">Remove {qualification.name}</span>
                    <X aria-hidden="true" className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="relative">
            <input
              className="w-full bg-transparent pr-7 text-[13px] text-ink outline-none placeholder:text-slate/50"
              disabled={qualLoading}
              onBlur={() => onBlur({ target: { name: 'qualifications' } })}
              onChange={(event) => setQualInput(event.target.value)}
              onKeyDown={handleQualKeyDown}
              placeholder="Add qualification..."
              type="text"
              value={qualInput}
            />
            {qualLoading ? (
              <span className="absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
            ) : null}
          </div>
        </div>
        <FieldError>
          {(touched.qualifications && errors.qualifications) || qualError}
        </FieldError>
      </div>

      <div>
        <span
          className={[
            'mb-2 block text-[13px] font-medium',
            touched.specializations && errors.specializations
              ? 'text-rose-600'
              : 'text-ink',
          ].join(' ')}
        >
          Specializations *
        </span>
        <select
          className="mb-2 h-[38px] w-full rounded-control border border-hairline bg-mist px-3 text-[13px] font-medium text-ink outline-none transition-colors focus:border-brand"
          defaultValue=""
          onChange={handleSpecializationSelect}
        >
          <option value="">Select specialization</option>
          {SPECIALIZATION_OPTIONS.map((specialization) => (
            <option key={specialization} value={specialization}>
              {specialization}
            </option>
          ))}
          <option value="other">Other</option>
        </select>
        <div className="rounded-control border border-hairline bg-mist px-3 py-2.5">
          {data.specializations.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {data.specializations.map((spec, index) => (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand"
                  key={spec}
                >
                  {spec}
                  <button
                    className="rounded-full transition hover:bg-brand/10"
                    onClick={() => removeSpecialization(index)}
                    type="button"
                  >
                    <span className="sr-only">Remove {spec}</span>
                    <X aria-hidden="true" className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <input
            className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-slate/50"
            onBlur={() =>
              onBlur({ target: { name: 'specializations' } })
            }
            onChange={(event) => setSpecInput(event.target.value)}
            onKeyDown={handleSpecKeyDown}
            placeholder="Type custom specialization and press Enter"
            ref={specInputRef}
            type="text"
            value={specInput}
          />
        </div>
        <FieldError>{touched.specializations && errors.specializations}</FieldError>
      </div>

      <Field
        error={touched.experience_years && errors.experience_years}
        label="Experience (years) *"
      >
        <input
          className={INPUT_CLASS}
          name="experience_years"
          onBlur={onBlur}
          onChange={onChange}
          placeholder="0"
          type="number"
          value={data.experience_years}
        />
        {touched.experience_years &&
        Number(data.experience_years) > 60 &&
        !errors.experience_years ? (
          <FieldError tone="warning">
            Please verify - over 60 years is unusual.
          </FieldError>
        ) : null}
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field error={touched.shift_start && errors.shift_start} label="Shift Start *">
          <input
            className={INPUT_CLASS}
            name="shift_start"
            onBlur={onBlur}
            onChange={onChange}
            type="time"
            value={data.shift_start}
          />
        </Field>

        <Field error={touched.shift_end && errors.shift_end} label="Shift End *">
          <input
            className={INPUT_CLASS}
            name="shift_end"
            onBlur={onBlur}
            onChange={onChange}
            type="time"
            value={data.shift_end}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field error={touched.status && errors.status} label="Status *">
          <select
            className={INPUT_CLASS}
            name="status"
            onBlur={onBlur}
            onChange={onChange}
            value={data.status}
          >
            <option value="">Select status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="on_leave">On Leave</option>
          </select>
        </Field>

        <Field error={touched.join_date && errors.join_date} label="Join Date *">
          <input
            className={INPUT_CLASS}
            name="join_date"
            onBlur={onBlur}
            onChange={onChange}
            type="date"
            value={data.join_date}
          />
        </Field>
      </div>
    </div>
  )
}

export default DoctorFormFields
