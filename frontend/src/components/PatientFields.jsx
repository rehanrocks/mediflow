/* eslint-disable react-refresh/only-export-components -- Shares patient form helpers with route pages. */
import { useState } from 'react'

import { computeAge } from '../lib/age'
import {
  getRecordId,
  normalizeList,
  normalizeStringArray,
} from '../lib/records'
import {
  validateDateOfBirth,
  validatePhone,
  validatePositiveNumber,
} from '../lib/validation'
import { getPatients } from '../services/api'
import { FormField, FormSection, getFieldClass } from './FormPrimitives'
import TagInput from './TagInput'

export const EMPTY_PATIENT_FORM = {
  full_name: '',
  date_of_birth: '',
  sex: '',
  marital_status: '',
  phone: '',
  address: '',
  weight_kg: '',
  height_cm: '',
  physical_activity_level: '',
  pre_existing_conditions: [],
  known_allergies: [],
  current_medications: [],
  blood_group: 'Unknown',
}

export const PATIENT_SELECT_OPTIONS = {
  sex: ['Male', 'Female', 'Other'],
  marital_status: ['Single', 'Married', 'Divorced', 'Widowed'],
  physical_activity_level: [
    'Sedentary',
    'Lightly Active',
    'Moderately Active',
    'Very Active',
    'Athlete',
  ],
  blood_group: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
}

export function getPatientFormDefaults(patient = null) {
  if (!patient) {
    return EMPTY_PATIENT_FORM
  }

  return {
    full_name: patient.full_name || patient.name || '',
    date_of_birth: patient.date_of_birth || patient.dob || '',
    sex: patient.sex || '',
    marital_status: patient.marital_status || '',
    phone: patient.phone || '',
    address: patient.address || '',
    weight_kg: patient.weight_kg ?? patient.weight ?? '',
    height_cm: patient.height_cm ?? patient.height ?? '',
    physical_activity_level: patient.physical_activity_level || '',
    pre_existing_conditions: normalizeStringArray(
      patient.pre_existing_conditions || patient.condition,
    ),
    known_allergies: normalizeStringArray(patient.known_allergies || patient.allergies),
    current_medications: normalizeStringArray(
      patient.current_medications || patient.medications,
    ),
    blood_group: patient.blood_group || 'Unknown',
  }
}

export function toPatientPayload(values) {
  return {
    full_name: values.full_name.trim(),
    date_of_birth: values.date_of_birth,
    sex: values.sex,
    marital_status: values.marital_status,
    phone: values.phone.trim(),
    address: values.address.trim(),
    weight_kg: Number(values.weight_kg),
    height_cm: Number(values.height_cm),
    physical_activity_level: values.physical_activity_level,
    pre_existing_conditions: normalizeStringArray(values.pre_existing_conditions),
    known_allergies: normalizeStringArray(values.known_allergies),
    current_medications: normalizeStringArray(values.current_medications),
    blood_group: values.blood_group || 'Unknown',
  }
}

function required(label) {
  return {
    required: `${label} is required.`,
  }
}

function SelectField({ error, label, name, options, register }) {
  return (
    <FormField error={error} label={label}>
      <select className={getFieldClass(error)} {...register(name, required(label))}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FormField>
  )
}

export function PatientFields({
  clearErrors,
  currentPatientId,
  errors,
  register,
  setError,
  setValue,
  watch,
}) {
  const [checkingPhone, setCheckingPhone] = useState(false)
  const dob = watch('date_of_birth')
  const age = computeAge(dob)
  const phoneError = errors.phone?.message
  const phoneRegistration = register('phone', {
    required: 'Phone is required.',
    validate: (value) => validatePhone(value) || true,
  })

  async function handlePhoneBlur(event) {
    phoneRegistration.onBlur(event)
    const value = event.target.value.trim()
    const formatError = validatePhone(value)

    if (!value || formatError) {
      return
    }

    setCheckingPhone(true)

    try {
      const response = await getPatients({ phone: value })
      const matchingPatients = normalizeList(response)
      const duplicate = matchingPatients.find(
        (patient) =>
          patient.phone === value &&
          String(getRecordId(patient)) !== String(currentPatientId || ''),
      )

      if (duplicate) {
        setError('phone', {
          type: 'manual',
          message: 'Phone already registered',
        })
      } else if (errors.phone?.type === 'manual') {
        clearErrors('phone')
      }
    } catch {
      return
    } finally {
      setCheckingPhone(false)
    }
  }

  function setTagValue(fieldName, nextValue) {
    setValue(fieldName, nextValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    })
  }

  return (
    <div className="space-y-8">
      <FormSection title="Personal Information">
        <FormField error={errors.full_name?.message} label="Full Name">
          <input
            className={getFieldClass(errors.full_name?.message)}
            placeholder="Patient full name"
            type="text"
            {...register('full_name', {
              required: 'Full name is required.',
              minLength: {
                value: 2,
                message: 'Full name must be at least 2 characters.',
              },
            })}
          />
        </FormField>

        <FormField error={errors.date_of_birth?.message} label="Date of Birth">
          <input
            className={getFieldClass(errors.date_of_birth?.message, 'font-mono')}
            type="date"
            {...register('date_of_birth', {
              validate: (value) => validateDateOfBirth(value) || true,
            })}
          />
          {Number.isFinite(age) && !errors.date_of_birth ? (
            <p className="mt-1.5 font-mono text-[12px] font-medium text-brand">
              Age: {age} years
            </p>
          ) : null}
        </FormField>

        <SelectField
          error={errors.sex?.message}
          label="Sex"
          name="sex"
          options={PATIENT_SELECT_OPTIONS.sex}
          register={register}
        />

        <SelectField
          error={errors.marital_status?.message}
          label="Marital Status"
          name="marital_status"
          options={PATIENT_SELECT_OPTIONS.marital_status}
          register={register}
        />

        <FormField
          error={phoneError}
          hint="Format: +[country code][number] · e.g. +923001234567"
          label="Phone"
        >
          <div className="relative">
            <input
              className={getFieldClass(phoneError, 'pr-9 font-mono')}
              placeholder="+923001234567"
              type="tel"
              {...phoneRegistration}
              onBlur={handlePhoneBlur}
            />
            {checkingPhone ? (
              <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
            ) : null}
          </div>
        </FormField>

        <FormField error={errors.address?.message} label="Address">
          <textarea
            className={getFieldClass(errors.address?.message, 'min-h-[76px] resize-none')}
            placeholder="Patient address"
            rows={2}
            {...register('address', required('Address'))}
          />
        </FormField>
      </FormSection>

      <FormSection title="Physical Profile">
        <FormField error={errors.weight_kg?.message} label="Weight (kg)">
          <input
            className={getFieldClass(errors.weight_kg?.message, 'font-mono')}
            placeholder="72.5"
            step="0.1"
            type="number"
            {...register('weight_kg', {
              required: 'Weight is required.',
              max: {
                value: 500,
                message: 'Weight cannot be greater than 500 kg.',
              },
              validate: (value) => validatePositiveNumber(value) || true,
            })}
          />
        </FormField>

        <FormField error={errors.height_cm?.message} label="Height (cm)">
          <input
            className={getFieldClass(errors.height_cm?.message, 'font-mono')}
            placeholder="175"
            step="1"
            type="number"
            {...register('height_cm', {
              required: 'Height is required.',
              max: {
                value: 300,
                message: 'Height cannot be greater than 300 cm.',
              },
              validate: (value) => validatePositiveNumber(value) || true,
            })}
          />
        </FormField>

        <div className="md:col-span-2">
          <SelectField
            error={errors.physical_activity_level?.message}
            label="Physical Activity Level"
            name="physical_activity_level"
            options={PATIENT_SELECT_OPTIONS.physical_activity_level}
            register={register}
          />
        </div>
      </FormSection>

      <FormSection title="Medical Background">
        <FormField label="Pre-existing Conditions" optional>
          <TagInput
            onChange={(nextValue) => setTagValue('pre_existing_conditions', nextValue)}
            placeholder="Diabetes, Hypertension"
            value={watch('pre_existing_conditions') || []}
          />
        </FormField>

        <FormField label="Known Allergies" optional>
          <TagInput
            onChange={(nextValue) => setTagValue('known_allergies', nextValue)}
            placeholder="Penicillin"
            value={watch('known_allergies') || []}
          />
        </FormField>

        <FormField label="Current Medications" optional>
          <TagInput
            onChange={(nextValue) => setTagValue('current_medications', nextValue)}
            placeholder="Metformin"
            value={watch('current_medications') || []}
          />
        </FormField>

        <FormField error={errors.blood_group?.message} label="Blood Group" optional>
          <select
            className={getFieldClass(errors.blood_group?.message)}
            {...register('blood_group')}
          >
            {PATIENT_SELECT_OPTIONS.blood_group.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FormField>
      </FormSection>
    </div>
  )
}

export default PatientFields
