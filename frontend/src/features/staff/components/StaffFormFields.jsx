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
  const roleValue = String(data.role || '')
  const joinDateWarning = !errors.joining_date
    ? getStaffJoiningDateWarning(data.joining_date)
    : ''
  const matchedRoleName = useMemo(() => {
    if (!Array.isArray(roleOptions)) {
      return ''
    }

    return roleOptions.find((role) => role.name === roleValue)?.name || ''
  }, [roleOptions, roleValue])
  const usingCustomRole =
    showCustomRole ||
    (Array.isArray(roleOptions) && Boolean(roleValue) && !matchedRoleName)

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
    if (roleOptions === null && !roleOptionsFailed) {
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

    if (roleOptionsFailed || roleOptions === undefined) {
      return (
        <>
          <input
            className={getFieldClass(touched.role ? errors.role : '')}
            name="role"
            onBlur={onBlur}
            onChange={onChange}
            placeholder="e.g. Nurse, Ward Boy, Sweeper, Security Guard..."
            type="text"
            value={data.role}
          />
          {roleOptionsFailed ? (
            <p className="mt-1.5 text-[12px] text-slate">
              Could not load role suggestions.
            </p>
          ) : null}
        </>
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
          {roleOptions.map((role) => (
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
      </div>
    )
  }

  return (
    <>
      <FormSection title="Personal Details">
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
