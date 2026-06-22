/* eslint-disable react-refresh/only-export-components -- Shares appointment form helpers with route pages. */
import { PaymentToggle } from './PaymentBadge'
import {
  FieldError,
  FormField,
  FormSection,
  getFieldClass,
} from './FormPrimitives'
import {
  getRecordId,
  getDoctorName,
} from '../lib/records'
import {
  getTemperatureWarning,
  validateBloodPressure,
  validateFutureDateTime,
} from '../lib/validation'

export const EMPTY_APPOINTMENT_FORM = {
  doctor: '',
  appointment_dt: '',
  reason: '',
  temperature: '',
  blood_pressure: '',
  notes: '',
  payment_status: 'unpaid',
}

export function getAppointmentFormDefaults(appointment = null) {
  if (!appointment) {
    return EMPTY_APPOINTMENT_FORM
  }

  return {
    doctor:
      getRecordId(appointment.doctor) ??
      appointment.doctor ??
      '',
    appointment_dt: toDatetimeLocalValue(appointment.appointment_dt),
    reason: appointment.reason || '',
    temperature: appointment.temperature || '',
    blood_pressure: appointment.blood_pressure || '',
    notes: appointment.notes || appointment.additional_notes || '',
    payment_status: appointment.payment_status || 'unpaid',
  }
}

export function toAppointmentPayload(values) {
  return {
    doctor: values.doctor,
    appointment_dt: values.appointment_dt,
    reason: values.reason?.trim() || '',
    temperature: values.temperature ? String(values.temperature) : '',
    blood_pressure: values.blood_pressure?.trim() || '',
    notes: values.notes?.trim() || '',
    payment_status: values.payment_status || 'unpaid',
  }
}

export function toDatetimeLocalValue(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return offsetDate.toISOString().slice(0, 16)
}

export function AppointmentFields({
  doctors,
  errors,
  lockPaid = false,
  register,
  requireFuture = true,
  setValue,
  watch,
}) {
  const temperature = watch('temperature')
  const paymentStatus = watch('payment_status')
  const temperatureWarning = getTemperatureWarning(temperature)

  return (
    <FormSection title="Visit Details">
      <FormField error={errors.doctor?.message} label="Doctor">
        <select
          className={getFieldClass(errors.doctor?.message)}
          {...register('doctor', { required: 'Doctor is required.' })}
        >
          <option value="">Select doctor</option>
          {doctors.map((doctor) => (
            <option key={getRecordId(doctor)} value={getRecordId(doctor)}>
              {getDoctorName(doctor, 'Unnamed doctor')}
            </option>
          ))}
        </select>
      </FormField>

      <FormField error={errors.appointment_dt?.message} label="Date & Time">
        <input
          className={getFieldClass(errors.appointment_dt?.message, 'font-mono')}
          type="datetime-local"
          {...register('appointment_dt', {
            validate: (value) =>
              requireFuture
                ? validateFutureDateTime(value) || true
                : value
                  ? true
                  : 'Date and time are required.',
          })}
        />
      </FormField>

      <div className="md:col-span-2">
        <FormField label="Reason for Visit" optional>
          <input
            className={getFieldClass(false)}
            placeholder="Routine check-in"
            type="text"
            {...register('reason')}
          />
        </FormField>
      </div>

      <FormField error={errors.temperature?.message} label="Temperature (C)" optional>
        <input
          className={getFieldClass(errors.temperature?.message, 'font-mono')}
          placeholder="37.2"
          step="0.1"
          type="number"
          {...register('temperature')}
        />
        <FieldError tone="warning">{temperatureWarning}</FieldError>
      </FormField>

      <FormField
        error={errors.blood_pressure?.message}
        hint="Format: 120/80"
        label="Blood Pressure"
        optional
      >
        <input
          className={getFieldClass(errors.blood_pressure?.message, 'font-mono')}
          placeholder="120/80"
          type="text"
          {...register('blood_pressure', {
            validate: (value) => validateBloodPressure(value) || true,
          })}
        />
      </FormField>

      <div className="md:col-span-2">
        <FormField label="Notes / Piece Field" optional>
          <textarea
            className={getFieldClass(false, 'min-h-[92px] resize-none')}
            placeholder="Free-form clinical notes"
            rows={3}
            {...register('notes')}
          />
        </FormField>
      </div>

      <div className="md:col-span-2">
        <FormField label="Payment Status">
          <PaymentToggle
            lockPaid={lockPaid}
            onChange={(nextValue) =>
              setValue('payment_status', nextValue, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            value={paymentStatus}
          />
        </FormField>
      </div>
    </FormSection>
  )
}

export default AppointmentFields
