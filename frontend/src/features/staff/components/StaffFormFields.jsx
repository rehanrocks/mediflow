/* src/features/staff/components/StaffFormFields.jsx - Shared staff form controls. */
import {
  FormField,
  FormSection,
  getFieldClass,
} from '@shared/components/FormPrimitives'

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
          hint="Type any role title as needed - this field is flexible."
          label="Role"
        >
          <input
            className={getFieldClass(touched.role ? errors.role : '')}
            name="role"
            onBlur={onBlur}
            onChange={onChange}
            placeholder="e.g. Nurse, Ward Boy, Sweeper, Security Guard..."
            type="text"
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
