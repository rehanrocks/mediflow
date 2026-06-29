/* src/features/staff/components/StaffFormFields.jsx - Shared staff form controls. */
import { useMemo, useState } from 'react'

import {
  FieldError,
  FormField,
  FormSection,
  getFieldClass,
} from '@shared/components/FormPrimitives'
import { getStaffJoiningDateWarning } from '@shared/lib/staffUtils'

const OTHER_ROLE_VALUE = '__other__'
const EMAIL_HELPER_TEXT = 'Login credentials will be sent to this email address.'

const DEFAULT_SYSTEM_ROLES = [
  { name: 'Admin', slug: 'admin', is_system: true },
  { name: 'Doctor', slug: 'doctor', is_system: true },
]

function mergeRoleOptions(apiRoles) {
  if (!Array.isArray(apiRoles) || apiRoles.length === 0) {
    return DEFAULT_SYSTEM_ROLES
  }

  const merged = [...DEFAULT_SYSTEM_ROLES]

  for (const role of apiRoles) {
    if (!DEFAULT_SYSTEM_ROLES.some((defaultRole) => defaultRole.name === role.name)) {
      merged.push(role)
    }
  }

  return merged
}

export function StaffFormFields({
  data,
  errors = {},
  onBlur,
  onChange,
  roleOptions,
  roleOptionsFailed = false,
  showStatus = true,
  touched = {},
}) {
  const [showCustomRole, setShowCustomRole] = useState(false)
  const resolvedRoleOptions = useMemo(() => {
    if (roleOptions === null) return null
    if (roleOptionsFailed || roleOptions === undefined) return DEFAULT_SYSTEM_ROLES
    return mergeRoleOptions(roleOptions)
  }, [roleOptions, roleOptionsFailed])

  const roleValue = String(data.role || '')
  const emailReadOnly = data.has_account === true
  const joinDateWarning = !errors.joining_date
    ? getStaffJoiningDateWarning(data.joining_date)
    : ''
  const matchedRoleName = useMemo(() => {
    if (!Array.isArray(resolvedRoleOptions)) {
      return ''
    }

    return resolvedRoleOptions.find((role) => role.name === roleValue)?.name || ''
  }, [resolvedRoleOptions, roleValue])
  const usingCustomRole =
    showCustomRole ||
    (Array.isArray(resolvedRoleOptions) && Boolean(roleValue) && !matchedRoleName)

  function emitRoleChange(value) {
    onChange({
      target: {
        name: 'role',
        value,
      },
    })
  }

  function handleRoleSelect(event) {
    const nextValue = event.target.value

    if (nextValue === OTHER_ROLE_VALUE) {
      setShowCustomRole(true)

      if (matchedRoleName) {
        emitRoleChange('')
      }

      return
    }

    setShowCustomRole(false)
    emitRoleChange(nextValue)
  }

  function renderRoleControl() {
    if (resolvedRoleOptions === null) {
      return (
        <select
          className={getFieldClass('', 'text-slate')}
          disabled
          name="role"
          value=""
        >
          <option value="">Loading roles...</option>
        </select>
      )
    }

    return (
      <div className="space-y-2">
        <select
          className={getFieldClass(touched.role ? errors.role : '')}
          name="role"
          onBlur={onBlur}
          onChange={handleRoleSelect}
          value={usingCustomRole ? OTHER_ROLE_VALUE : matchedRoleName}
        >
          <option value="">Select a role...</option>
          {resolvedRoleOptions.map((role) => (
            <option key={role.id || role.slug || role.name} value={role.name}>
              {role.name}
            </option>
          ))}
          <option value={OTHER_ROLE_VALUE}>Other...</option>
        </select>

        {usingCustomRole ? (
          <input
            className={getFieldClass(touched.role ? errors.role : '')}
            name="role"
            onBlur={onBlur}
            onChange={onChange}
            placeholder="Type custom role title..."
            type="text"
            value={data.role}
          />
        ) : null}

        {roleOptionsFailed ? (
          <p className="mt-1.5 text-[12px] text-slate">
            Could not load additional role suggestions.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <FormSection title="Personal Details">
        {roleValue.toLowerCase() !== 'doctor' ? (
          <FormField
            error={touched.full_name ? errors.full_name : ''}
            label="Full Name"
          >
            <input
              className={getFieldClass(touched.full_name ? errors.full_name : '')}
              name="full_name"
              onBlur={onBlur}
              onChange={onChange}
              placeholder="Aisha Khan"
              type="text"
              value={data.full_name}
            />
          </FormField>
        ) : null}

        <FormField
          error={touched.age ? errors.age : ''}
          hint="Staff age must be between 18 and 60."
          label="Age"
        >
          <input
            className={getFieldClass(touched.age ? errors.age : '')}
            max="60"
            min="18"
            name="age"
            onBlur={onBlur}
            onChange={onChange}
            placeholder="28"
            step="1"
            type="number"
            value={data.age}
          />
        </FormField>

        <FormField error={touched.phone ? errors.phone : ''} label="Phone">
          <input
            className={getFieldClass(touched.phone ? errors.phone : '')}
            name="phone"
            onBlur={onBlur}
            onChange={onChange}
            placeholder="+923001234567"
            type="tel"
            value={data.phone}
          />
        </FormField>

        <FormField error={touched.email ? errors.email : ''} label="Email">
          <input
            className={getFieldClass(
              touched.email ? errors.email : '',
              emailReadOnly ? 'cursor-not-allowed bg-mist text-slate' : '',
            )}
            name="email"
            onBlur={onBlur}
            onChange={onChange}
            placeholder="name@clinic.com"
            readOnly={emailReadOnly}
            type="email"
            value={data.email}
          />
          <p className="mt-1.5 text-[11px] font-normal text-slate/60">
            {EMAIL_HELPER_TEXT}
          </p>
          {emailReadOnly ? (
            <FieldError tone="warning">
              Email cannot be changed after account creation.
            </FieldError>
          ) : null}
        </FormField>

        <div className="md:col-span-2">
          <FormField
            error={touched.address ? errors.address : ''}
            label="Address"
            optional
          >
            <textarea
              className={getFieldClass(
                touched.address ? errors.address : '',
                'min-h-[72px] resize-y',
              )}
              name="address"
              onBlur={onBlur}
              onChange={onChange}
              placeholder="Street, city"
              rows={2}
              value={data.address}
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Employment Details">
        <FormField
          error={touched.role ? errors.role : ''}
          hint="You can select an existing role or type a custom one."
          label="Role"
        >
          {renderRoleControl()}
        </FormField>

        <FormField
          error={touched.joining_date ? errors.joining_date : ''}
          label="Joining Date"
        >
          <input
            className={getFieldClass(touched.joining_date ? errors.joining_date : '')}
            name="joining_date"
            onBlur={onBlur}
            onChange={onChange}
            type="date"
            value={data.joining_date}
          />
          <FieldError tone="warning">{joinDateWarning}</FieldError>
        </FormField>

        {showStatus ? (
          <FormField error={touched.status ? errors.status : ''} label="Status">
            <select
              className={getFieldClass(touched.status ? errors.status : '')}
              name="status"
              onBlur={onBlur}
              onChange={onChange}
              value={data.status}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
        ) : null}
      </FormSection>

      {roleValue.toLowerCase() === 'doctor' ? (
        <FormSection title="Doctor Profile">
          <FormField
            error={touched.first_name ? errors.first_name : ''}
            label="First Name"
          >
            <input
              className={getFieldClass(touched.first_name ? errors.first_name : '')}
              name="first_name"
              onBlur={onBlur}
              onChange={onChange}
              placeholder="John"
              type="text"
              value={data.first_name || ''}
            />
          </FormField>

          <FormField
            error={touched.last_name ? errors.last_name : ''}
            label="Last Name"
          >
            <input
              className={getFieldClass(touched.last_name ? errors.last_name : '')}
              name="last_name"
              onBlur={onBlur}
              onChange={onChange}
              placeholder="Doe"
              type="text"
              value={data.last_name || ''}
            />
          </FormField>

          <FormField
            error={touched.qualification ? errors.qualification : ''}
            label="Qualification"
          >
            <input
              className={getFieldClass(touched.qualification ? errors.qualification : '')}
              name="qualification"
              onBlur={onBlur}
              onChange={onChange}
              placeholder="e.g. MBBS, FCPS"
              type="text"
              value={data.qualification || ''}
            />
          </FormField>

          <FormField
            error={touched.specializations ? errors.specializations : ''}
            hint="Comma-separated specializations"
            label="Specializations"
          >
            <input
              className={getFieldClass(touched.specializations ? errors.specializations : '')}
              name="specializations"
              onBlur={onBlur}
              onChange={(event) => {
                const raw = event.target.value
                onChange({
                  target: {
                    name: 'specializations',
                    value: raw
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }}
              placeholder="Cardiology, Neurology, Pediatrics"
              type="text"
              value={(data.specializations || []).join(', ')}
            />
          </FormField>

          <FormField
            error={touched.experience_years ? errors.experience_years : ''}
            label="Experience (Years)"
          >
            <input
              className={getFieldClass(touched.experience_years ? errors.experience_years : '')}
              max="60"
              min="0"
              name="experience_years"
              onBlur={onBlur}
              onChange={onChange}
              placeholder="5"
              type="number"
              value={data.experience_years ?? ''}
            />
          </FormField>

          <FormField
            error={touched.doctor_status ? errors.doctor_status : ''}
            label="Doctor Status"
          >
            <select
              className={getFieldClass(touched.doctor_status ? errors.doctor_status : '')}
              name="doctor_status"
              onBlur={onBlur}
              onChange={onChange}
              value={data.doctor_status || 'active'}
            >
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
        </FormSection>
      ) : null}

      <FormSection title="Working Hours">
        <FormField
          error={touched.shift_start ? errors.shift_start : ''}
          label="Shift Start"
        >
          <input
            className={getFieldClass(touched.shift_start ? errors.shift_start : '')}
            name="shift_start"
            onBlur={onBlur}
            onChange={onChange}
            type="time"
            value={data.shift_start}
          />
        </FormField>

        <FormField
          error={touched.shift_end ? errors.shift_end : ''}
          label="Shift End"
        >
          <input
            className={getFieldClass(touched.shift_end ? errors.shift_end : '')}
            name="shift_end"
            onBlur={onBlur}
            onChange={onChange}
            type="time"
            value={data.shift_end}
          />
        </FormField>
      </FormSection>

      <FormSection title="Notes">
        <div className="md:col-span-2">
          <FormField
            error={touched.notes ? errors.notes : ''}
            label="Notes"
            optional
          >
            <textarea
              className={getFieldClass(
                touched.notes ? errors.notes : '',
                'min-h-[104px] resize-y',
              )}
              name="notes"
              onBlur={onBlur}
              onChange={onChange}
              placeholder="Admin notes"
              rows={3}
              value={data.notes}
            />
          </FormField>
        </div>
      </FormSection>
    </>
  )
}

export default StaffFormFields
