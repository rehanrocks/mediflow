/* src/pages/Patients.jsx - Provides searchable patient records and staff-only creation. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Eye,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { useForm } from 'react-hook-form'

import Avatar from '../components/Avatar'
import Drawer from '../components/Drawer'
import SkeletonRow from '../components/SkeletonRow'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { stagger } from '../lib/motion'
import {
  createPatient,
  deletePatient,
  getPatients,
  updatePatient,
} from '../services/api'

const EMPTY_PATIENT_FORM = {
  full_name: '',
  phone: '',
  age: '',
  condition: '',
}

function normalizeList(response) {
  if (Array.isArray(response)) {
    return response
  }

  if (Array.isArray(response?.results)) {
    return response.results
  }

  return []
}

function getRecordId(record) {
  return record?.id ?? record?.pk ?? record?.uuid ?? record?.phone
}

function getBackendError(error, fallback) {
  const data = error?.response?.data

  if (typeof error?.detail === 'string') {
    return error.detail
  }

  if (typeof data?.detail === 'string') {
    return data.detail
  }

  if (typeof data === 'string') {
    return data
  }

  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([field, messages]) => {
        const message = Array.isArray(messages) ? messages.join(' ') : messages
        return `${field}: ${message}`
      })
      .join(' ')
  }

  return fallback
}

function FieldError({ children }) {
  if (!children) {
    return null
  }

  return (
    <p className="mt-1.5 flex items-center gap-1 text-[12px] font-normal text-rose-500">
      <AlertCircle aria-hidden="true" className="h-[13px] w-[13px]" />
      {children}
    </p>
  )
}

function DrawerField({ children, label, optional }) {
  return (
    <label className="block animate-fade-up">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
        {optional ? (
          <span className="ml-1 text-[12px] font-normal text-slate">
            (optional)
          </span>
        ) : null}
      </span>
      {children}
    </label>
  )
}

export function Patients() {
  const { user } = useAuth()
  const toast = useToast()
  const canManagePatients = user?.role !== 'doctor'
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState('add')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [isDeletingPatient, setIsDeletingPatient] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [newPatientId, setNewPatientId] = useState(null)
  const hasLoadedRef = useRef(false)
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm({
    defaultValues: EMPTY_PATIENT_FORM,
  })

  const loadPatients = useCallback(
    async (searchTerm, isMounted = () => true, initial = false) => {
      if (initial) {
        setIsLoading(true)
      } else {
        setIsSearching(true)
      }
      setLoadError('')

      try {
        const response = await getPatients(searchTerm.trim())

        if (!isMounted()) {
          return
        }

        setPatients(normalizeList(response))
      } catch (error) {
        if (!isMounted()) {
          return
        }

        setLoadError(getBackendError(error, 'Patients could not be loaded.'))
      } finally {
        if (isMounted()) {
          setIsLoading(false)
          setIsSearching(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    let isMounted = true
    const initial = !hasLoadedRef.current
    hasLoadedRef.current = true
    const debounceId = setTimeout(() => {
      loadPatients(search, () => isMounted, initial)
    }, 300)

    return () => {
      isMounted = false
      clearTimeout(debounceId)
    }
  }, [loadPatients, search])

  useEffect(() => {
    if (!deleteCandidate) {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isDeletingPatient) {
        setDeleteCandidate(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [deleteCandidate, isDeletingPatient])

  const patientRows = useMemo(
    () =>
      patients.map((patient) => ({
        id: getRecordId(patient),
        name: patient.full_name || patient.name || 'Unnamed patient',
        phone: patient.phone || '-',
        age: patient.age ?? '-',
        condition: patient.condition || '',
      })),
    [patients],
  )

  function getPatientFormValues(patient = null) {
    if (!patient) {
      return EMPTY_PATIENT_FORM
    }

    return {
      full_name: patient.name,
      phone: patient.phone === '-' ? '' : patient.phone,
      age: patient.age === '-' ? '' : patient.age,
      condition: patient.condition || '',
    }
  }

  function openAddPatient() {
    setDrawerMode('add')
    setSelectedPatient(null)
    setFormError('')
    reset(EMPTY_PATIENT_FORM)
    setDrawerOpen(true)
  }

  function openViewPatient(patient) {
    setDrawerMode('view')
    setSelectedPatient(patient)
    setFormError('')
    reset(getPatientFormValues(patient))
    setDrawerOpen(true)
  }

  function openEditPatient(patient) {
    setDrawerMode('edit')
    setSelectedPatient(patient)
    setFormError('')
    reset(getPatientFormValues(patient))
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setFormError('')
  }

  async function handleSavePatient(formValues) {
    setFormError('')

    try {
      const payload = {
        full_name: formValues.full_name,
        phone: formValues.phone,
        age: Number(formValues.age),
        condition: formValues.condition,
      }

      if (drawerMode === 'edit' && selectedPatient) {
        const updatedPatient = await updatePatient(selectedPatient.id, payload)
        const updatedRow = updatedPatient && typeof updatedPatient === 'object'
          ? updatedPatient
          : {
              id: selectedPatient.id,
              ...payload,
            }
        const updatedRowId = getRecordId(updatedRow)

        setPatients((currentPatients) =>
          currentPatients.map((patient) =>
            String(getRecordId(patient)) === String(selectedPatient.id)
              ? updatedRow
              : patient,
          ),
        )
        setNewPatientId(updatedRowId)
        window.setTimeout(() => setNewPatientId(null), 600)
        toast.success('Patient updated successfully.')
        setSelectedPatient({
          id: updatedRowId,
          name: updatedRow.full_name || updatedRow.name || formValues.full_name,
          phone: updatedRow.phone || formValues.phone,
          age: updatedRow.age ?? formValues.age,
          condition: updatedRow.condition || '',
        })
        reset(getPatientFormValues({
          id: updatedRowId,
          name: updatedRow.full_name || updatedRow.name || formValues.full_name,
          phone: updatedRow.phone || formValues.phone,
          age: updatedRow.age ?? formValues.age,
          condition: updatedRow.condition || '',
        }))
        setDrawerMode('view')
        return
      }

      const createdPatient = await createPatient(payload)
      const row = createdPatient && typeof createdPatient === 'object'
        ? createdPatient
        : {
            id: formValues.phone,
            ...formValues,
            age: Number(formValues.age),
          }
      const rowId = getRecordId(row)
      setPatients((currentPatients) => [row, ...currentPatients])
      setNewPatientId(rowId)
      window.setTimeout(() => setNewPatientId(null), 600)
      toast.success('Patient added successfully.')
      reset()
      setDrawerOpen(false)
    } catch (error) {
      const message = getBackendError(error, 'Patient could not be added.')
      setFormError(message)
      toast.error(message)
    }
  }

  function requestDeletePatient(patient) {
    setDeleteCandidate(patient)
  }

  async function handleDeletePatient(patient = deleteCandidate) {
    if (!patient) {
      return
    }

    setIsDeletingPatient(true)

    try {
      await deletePatient(patient.id)
      setPatients((currentPatients) =>
        currentPatients.filter(
          (currentPatient) =>
            String(getRecordId(currentPatient)) !== String(patient.id),
        ),
      )
      toast.success('Patient deleted.')
      setDeleteCandidate(null)

      if (selectedPatient?.id === patient.id) {
        setDrawerOpen(false)
        setSelectedPatient(null)
      }
    } catch (error) {
      toast.error(getBackendError(error, 'Patient could not be deleted.'))
    } finally {
      setIsDeletingPatient(false)
    }
  }

  const formInputClass =
    'w-full rounded-control border border-hairline bg-mist/50 px-4 py-2.5 text-[14px] font-normal text-ink outline-none transition-all duration-150 placeholder:text-slate/50 focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/25'

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 rounded-card bg-canvas p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block flex-1">
          <span className="sr-only">Search patients</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate"
          />
          <input
            className="h-11 w-full rounded-control border border-hairline bg-canvas pl-9 pr-10 text-[14px] font-normal text-ink outline-none transition-all duration-300 placeholder:text-slate/60 focus:border-brand focus:ring-2 focus:ring-brand/30"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or phone"
            type="search"
            value={search}
          />
          {isSearching ? (
            <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
          ) : null}
        </label>
        {canManagePatients ? (
          <button
            className="primary-button inline-flex h-11 items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            onClick={openAddPatient}
            type="button"
          >
            <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
            Add Patient
          </button>
        ) : null}
      </section>

      {loadError ? (
        <section className="rounded-card bg-canvas p-10 text-center shadow-card">
          <UserPlus
            aria-hidden="true"
            className="mx-auto mb-4 h-10 w-10 text-slate/30"
          />
          <h2 className="text-[16px] font-semibold text-ink">
            Something went wrong
          </h2>
          <p className="mt-1 text-[14px] font-normal text-slate">{loadError}</p>
          <button
            className="mt-5 rounded-control border border-hairline bg-canvas px-4 py-2 text-sm font-semibold text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            onClick={() => loadPatients(search)}
            type="button"
          >
            Try again
          </button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-card bg-canvas shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead className="border-b border-hairline bg-mist">
                <tr>
                  {['Patient', 'Age', 'Phone', 'Condition', 'Actions'].map(
                    (header) => (
                      <th
                        className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate"
                        key={header}
                        scope="col"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <SkeletonRow index={index} key={index} />
                  ))
                ) : patientRows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-10 text-center" colSpan={5}>
                      <p className="text-[16px] font-semibold text-ink">
                        No patients found
                      </p>
                      <p className="mt-1 text-[14px] font-normal text-slate">
                        Try a different search or add the first patient.
                      </p>
                    </td>
                  </tr>
                ) : (
                  patientRows.map((patient, index) => (
                    <tr
                      className={[
                        'animate-fade-up border-b border-hairline transition-colors duration-100 last:border-0 hover:bg-brand-light/40',
                        patient.id === newPatientId ? 'bg-brand-light' : '',
                      ].join(' ')}
                      key={patient.id}
                      style={stagger(index, 0.03)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={patient.name} size="md" />
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium text-ink">
                              {patient.name}
                            </p>
                            <p className="truncate font-mono text-[11px] font-medium text-slate">
                              ID {patient.id || 'pending'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-[14px] font-medium text-ink">
                        {patient.age}
                      </td>
                      <td className="px-5 py-4 font-mono text-[13px] font-medium text-ink">
                        {patient.phone}
                      </td>
                      <td
                        className={[
                          'px-5 py-4 text-[14px] font-normal',
                          patient.condition ? 'text-ink' : 'text-slate',
                        ].join(' ')}
                      >
                        {patient.condition || '-'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-brand/20 bg-brand-light text-brand transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                            onClick={() => openViewPatient(patient)}
                            title="View patient"
                            type="button"
                          >
                            <span className="sr-only">View patient</span>
                            <Eye aria-hidden="true" className="h-4 w-4" />
                          </button>
                          {canManagePatients ? (
                            <>
                              <button
                                className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-status-inProgress-text/20 bg-status-inProgress-bg text-status-inProgress-text transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                                onClick={() => openEditPatient(patient)}
                                title="Edit patient"
                                type="button"
                              >
                                <span className="sr-only">Edit patient</span>
                                <Pencil aria-hidden="true" className="h-4 w-4" />
                              </button>
                              <button
                                className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-status-cancelled-text/20 bg-status-cancelled-bg text-status-cancelled-text transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                                onClick={() => requestDeletePatient(patient)}
                                title="Delete patient"
                                type="button"
                              >
                                <span className="sr-only">Delete patient</span>
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Drawer
        footer={
          drawerMode === 'view' ? (
            <div className="flex justify-between gap-3">
              {canManagePatients && selectedPatient ? (
                <button
                  className="rounded-control border border-status-cancelled-text/20 bg-status-cancelled-bg px-4 py-2.5 text-[14px] font-semibold text-status-cancelled-text transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                  onClick={() => requestDeletePatient(selectedPatient)}
                  type="button"
                >
                  Delete
                </button>
              ) : <span />}
              <div className="flex gap-3">
                <button
                  className="rounded-control bg-mist px-4 py-2.5 text-[14px] font-medium text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                  onClick={closeDrawer}
                  type="button"
                >
                  Close
                </button>
                {canManagePatients && selectedPatient ? (
                  <button
                    className="primary-button rounded-control bg-brand px-4 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                    onClick={() => openEditPatient(selectedPatient)}
                    type="button"
                  >
                    Edit Patient
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <button
                className="rounded-control bg-mist px-4 py-2.5 text-[14px] font-medium text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                onClick={closeDrawer}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary-button flex min-w-[120px] items-center justify-center rounded-control bg-brand px-4 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting}
                form="patient-form"
                type="submit"
              >
                {isSubmitting ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : drawerMode === 'edit' ? (
                  'Save Changes'
                ) : (
                  'Add Patient'
                )}
              </button>
            </div>
          )
        }
        onClose={closeDrawer}
        open={drawerOpen}
        subtitle={
          drawerMode === 'view'
            ? 'Patient profile and contact details'
            : drawerMode === 'edit'
              ? 'Update the patient record'
              : 'Create a patient record'
        }
        title={
          drawerMode === 'view'
            ? selectedPatient?.name || 'Patient Details'
            : drawerMode === 'edit'
              ? 'Edit Patient'
              : 'Add Patient'
        }
        widthClass="max-w-[420px]"
      >
        {drawerMode === 'view' && selectedPatient ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-card bg-brand-light p-4">
              <Avatar name={selectedPatient.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold text-ink">
                  {selectedPatient.name}
                </p>
                <p className="mt-1 font-mono text-[12px] font-medium text-slate">
                  ID {selectedPatient.id || 'pending'}
                </p>
              </div>
            </div>

            {[
              ['Age', `${selectedPatient.age ?? '-'} years`],
              ['Phone', selectedPatient.phone || '-'],
              ['Condition', selectedPatient.condition || 'No condition recorded'],
            ].map(([label, value]) => (
              <div
                className="rounded-control border border-hairline bg-canvas px-4 py-3"
                key={label}
              >
                <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-slate">
                  {label}
                </p>
                <p
                  className={[
                    'mt-1 text-[14px] font-medium text-ink',
                    label === 'Phone' ? 'font-mono' : '',
                  ].join(' ')}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        ) : (
        <form
          className="space-y-5"
          id="patient-form"
          onSubmit={handleSubmit(handleSavePatient)}
        >
          <DrawerField label="Full Name">
            <input
              className={`${formInputClass} ${
                errors.full_name ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-400/25' : ''
              }`}
              placeholder="Patient name"
              type="text"
              {...register('full_name', { required: 'Full name is required.' })}
            />
            <FieldError>{errors.full_name?.message}</FieldError>
          </DrawerField>

          <DrawerField label="Phone">
            <input
              className={`${formInputClass} font-mono ${
                errors.phone ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-400/25' : ''
              }`}
              placeholder="Phone number"
              type="tel"
              {...register('phone', { required: 'Phone is required.' })}
            />
            <FieldError>{errors.phone?.message}</FieldError>
          </DrawerField>

          <DrawerField label="Age">
            <input
              className={`${formInputClass} font-mono ${
                errors.age ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-400/25' : ''
              }`}
              min="0"
              placeholder="Age"
              type="number"
              {...register('age', {
                required: 'Age is required.',
                min: {
                  value: 0,
                  message: 'Age cannot be negative.',
                },
              })}
            />
            <FieldError>{errors.age?.message}</FieldError>
          </DrawerField>

          <DrawerField label="Condition" optional>
            <input
              className={formInputClass}
              placeholder="Primary condition"
              type="text"
              {...register('condition')}
            />
          </DrawerField>

          {formError ? (
            <div className="flex animate-fade-up items-start gap-2 rounded-control border border-rose-200 bg-rose-50 px-4 py-3">
              <XCircle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
              />
              <p className="text-[13px] font-medium text-rose-700">{formError}</p>
            </div>
          ) : null}
        </form>
        )}
      </Drawer>

      {deleteCandidate ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-glass-dark px-4 backdrop-blur-xs animate-fade-in">
          <section
            aria-describedby="delete-patient-description"
            aria-labelledby="delete-patient-title"
            aria-modal="true"
            className="w-full max-w-[420px] rounded-card border border-hairline bg-canvas p-6 shadow-[0_16px_60px_rgba(20,24,31,0.18)] animate-scale-in"
            role="alertdialog"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-cancelled-bg text-status-cancelled-text">
                <AlertTriangle aria-hidden="true" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2
                  className="text-[18px] font-bold text-ink"
                  id="delete-patient-title"
                >
                  Delete patient?
                </h2>
                <p
                  className="mt-2 text-[14px] font-normal leading-6 text-slate"
                  id="delete-patient-description"
                >
                  This will remove{' '}
                  <span className="font-semibold text-ink">
                    {deleteCandidate.name}
                  </span>{' '}
                  and all associated appointments from the system.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-control bg-mist px-4 py-2.5 text-[14px] font-semibold text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDeletingPatient}
                onClick={() => setDeleteCandidate(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex min-w-[130px] items-center justify-center rounded-control bg-status-cancelled-text px-4 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-cancelled-text/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isDeletingPatient}
                onClick={() => handleDeletePatient(deleteCandidate)}
                type="button"
              >
                {isDeletingPatient ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  'Delete Patient'
                )}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default Patients
