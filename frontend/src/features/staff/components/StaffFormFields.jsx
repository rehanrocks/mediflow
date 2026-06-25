/* src/features/staff/components/StaffFormFields.jsx - Shared staff form controls. */
import { useEffect, useState } from 'react'
import {
  FormField,
  FormSection,
  getFieldClass,
} from '@shared/components/FormPrimitives'
import { getRoleNames } from '@shared/services/api'

const OTHER_VALUE = '__other__'

function RoleSelect({ error, hasError, onChange, value }) {
  const [roles, setRoles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [isOther, setIsOther] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadRoles() {
      try {
        const data = await getRoleNames()
        if (mounted) {
          setRoles(Array.isArray(data) ? data : [])
        }
      } catch {
        if (mounted) setFetchFailed(true)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadRoles()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (roles.length > 0 && value) {
      const matched = roles.find(
        (r) => r.name.toLowerCase() === String(value).toLowerCase()
      )
      setIsOther(!matched)
    }
  }, [roles, value])

  if (fetchFailed) {
    return (
      <input
        className={getFieldClass(hasError ? error : '')}
        name="role"
        onChange={onChange}
        placeholder="e.g. Nurse, Ward Boy, Sweeper, Security Guard..."
        type="text"
        value={value}
      />
    )
  }

  function handleSelectChange(e) {
    const selected = e.target.value
    if (selected === OTHER_VALUE) {
      setIsOther(true)
      onChange({ target: { name: 'role', value: '' } })
    } else {
      setIsOther(false)
      onChange({ target: { name: 'role', value: selected } })
    }
  }

  function handleCustomInput(e) {
    onChange({ target: { name: 'role', value: e.target.value } })
  }

  return (
    <>
      <select
        className={getFieldClass(hasError ? error : '', 'mb-2')}
        disabled={isLoading}
        name="role-select"
        onChange={handleSelectChange}
        value={
          isOther
            ? OTHER_VALUE
            : roles.find(
                (r) => r.name.toLowerCase() === String(value).toLowerCase()
              )?.name ?? (value ? OTHER_VALUE : '')
        }
      >
        {isLoading ? (
          <option value="">Loading roles...</option>
        ) : (
          <>
            <option value="">Select a role...</option>
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
            <option value={OTHER_VALUE}>Other (type your own)...</option>
          </>
        )}
      </select>

      {isOther && (
        <input
          className={getFieldClass(hasError ? error : '')}
          name="role"
          onChange={handleCustomInput}
          placeholder="Type custom role title..."
          type="text"
          value={value}
        />
      )}
    </>
  )
}

export function StaffFormFields({
  data,
  errors = {},
  onBlur,
  onChange,
  showStatus = true,
  touched = {},
}) {
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
          hint="Select an existing role or type a custom one."
          label="Role"
        >
          <RoleSelect
            error={touched.role ? errors.role : ''}
            hasError={!!(touched.role && errors.role)}
            onChange={onChange}
            value={data.role}
          />
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
