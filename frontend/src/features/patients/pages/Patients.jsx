/* src/features/patients/pages/Patients.jsx - Searchable patient records with route-based actions. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Info, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import Avatar from '@shared/components/Avatar'
import ConfirmationModal from '@shared/components/ConfirmationModal'
import Pagination from '@shared/components/Pagination'
import SkeletonRow from '@shared/components/SkeletonRow'
import { useToast } from '@shared/components/Toast'
import {
  formatDate,
  getBackendError,
  getPatientAge,
  getPatientConditions,
  getPatientName,
  getRecordId,
} from '@shared/lib/records'
import { stagger } from '@shared/lib/motion'
import {
  PAGE_SIZE,
  normalizePaginatedResponse,
  pageParams,
} from '@shared/lib/pagination'
import { usePermission } from '@shared/lib/usePermission'
import { deletePatient, getPatients } from '@shared/services/api'

function getPrimaryCondition(patient) {
  const conditions = getPatientConditions(patient)

  return conditions[0] || ''
}

export function Patients() {
  const { canDelete: canDeleteRecords, canWrite, role } = usePermission()
  const toast = useToast()
  const navigate = useNavigate()
  const doctorUser = role?.slug === 'doctor'
  const canCreatePatients = canWrite('patients')
  const canEditPatients = canWrite('patients')
  const canDeletePatients = canDeleteRecords()
  const [searchParams, setSearchParams] = useSearchParams()
  const [patients, setPatients] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [isDeletingPatient, setIsDeletingPatient] = useState(false)
  const hasLoadedRef = useRef(false)
  const search = searchParams.get('search') || ''

  const loadPatients = useCallback(
    async (searchTerm, pageNumber, isMounted = () => true, initial = false) => {
      if (initial) {
        setIsLoading(true)
      } else {
        setIsSearching(true)
      }
      setLoadError('')
      setPatients([])

      try {
        const response = await getPatients({
          ...pageParams(pageNumber),
          ordering: '-created_at',
          ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
        })
        const normalizedResponse = normalizePaginatedResponse(response)

        if (!isMounted()) {
          return
        }

        setPatients(normalizedResponse.results)
        setTotal(normalizedResponse.count)
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
    const debounceId = window.setTimeout(() => {
      loadPatients(search, page, () => isMounted, initial)
    }, 300)

    return () => {
      isMounted = false
      window.clearTimeout(debounceId)
    }
  }, [loadPatients, page, search])

  const patientRows = useMemo(
    () =>
      patients.map((patient) => ({
        id: getRecordId(patient),
        name: getPatientName(patient),
        phone: patient.phone || '-',
        age: getPatientAge(patient),
        condition: getPrimaryCondition(patient),
        lastVisit: patient.last_visit_date,
        nextAppointment: patient.next_appointment_date,
      })),
    [patients],
  )

  function handleSearchChange(event) {
    const nextSearch = event.target.value.trim()

    setPage(1)
    setSearchParams(nextSearch ? { search: nextSearch } : {}, {
      replace: true,
    })
  }

  function clearSearch() {
    setPage(1)
    setSearchParams({}, { replace: true })
  }

  async function handleDeletePatient() {
    if (!deleteCandidate) {
      return
    }

    setIsDeletingPatient(true)

    try {
      await deletePatient(deleteCandidate.id)
      setPatients((currentPatients) =>
        currentPatients.filter(
          (patient) => String(getRecordId(patient)) !== String(deleteCandidate.id),
        ),
      )
      toast.success('Patient deleted.')
      setDeleteCandidate(null)
    } catch (error) {
      toast.error(getBackendError(error, 'Patient could not be deleted.'))
    } finally {
      setIsDeletingPatient(false)
    }
  }

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
            onChange={handleSearchChange}
            placeholder="Search by name or phone"
            type="search"
            value={search}
          />
          {isSearching ? (
            <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-brand/20 border-t-brand animate-spin" />
          ) : search ? (
            <button
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              onClick={clearSearch}
              type="button"
            >
              <span className="sr-only">Clear patient search</span>
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </label>

        {canCreatePatients ? (
          <button
            className="primary-button inline-flex h-11 items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            onClick={() => navigate('/patients/new')}
            type="button"
          >
            <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
            Add Patient
          </button>
        ) : null}
      </section>

      {doctorUser ? (
        <section className="rounded-control bg-brand-light/50 px-4 py-2.5 text-[13px] font-normal text-slate">
          <p className="inline-flex items-center gap-2">
            <Info aria-hidden="true" className="h-[14px] w-[14px] text-brand" />
            Showing patients from your appointment history only.
          </p>
        </section>
      ) : null}

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
            onClick={() => loadPatients(search, page)}
            type="button"
          >
            Try again
          </button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-card bg-canvas shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] border-collapse text-left">
              <thead className="border-b border-hairline bg-mist">
                <tr>
                  {[
                    'Patient',
                    'Age',
                    'Phone',
                    'Condition',
                    'Last Visit',
                    'Next Appointment',
                    'Actions',
                  ].map((header) => (
                    <th
                      className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate"
                      key={header}
                      scope="col"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, index) => (
                    <SkeletonRow columns={7} index={index} key={index} />
                  ))
                ) : patientRows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-10 text-center" colSpan={7}>
                      <p className="text-[16px] font-semibold text-ink">
                        No patients found
                      </p>
                      <p className="mt-1 text-[14px] font-normal text-slate">
                        Try a different search or add the first patient.
                      </p>
                      {search.trim() ? (
                        <button
                          className="mt-4 text-sm font-semibold text-brand transition hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                          onClick={clearSearch}
                          type="button"
                        >
                          Clear search
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  patientRows.map((patient, index) => (
                    <tr
                      className="animate-fade-up border-b border-hairline transition-colors duration-100 last:border-0 hover:bg-brand-light/40"
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
                            <p className="truncate text-[12px] font-normal text-slate">
                              {patient.condition || 'No condition recorded'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-[14px] font-medium text-ink">
                        {Number.isFinite(patient.age) ? patient.age : '-'}
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
                      <td className="px-5 py-4 font-mono text-[12px] font-medium text-slate">
                        {patient.lastVisit ? (
                          formatDate(patient.lastVisit)
                        ) : (
                          <span className="text-slate/40">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-[12px] font-medium text-slate">
                        {patient.nextAppointment ? (
                          formatDate(patient.nextAppointment)
                        ) : (
                          <span className="text-slate/40">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            className="rounded-lg border border-blue-200 bg-blue-50 p-1.5 text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            title="View patient"
                            type="button"
                          >
                            <span className="sr-only">View patient</span>
                            <Eye aria-hidden="true" className="h-4 w-4" />
                          </button>
                          {canEditPatients ? (
                            <button
                              className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                              onClick={() => navigate(`/patients/${patient.id}/edit`)}
                              title="Edit patient"
                              type="button"
                            >
                              <span className="sr-only">Edit patient</span>
                              <Pencil aria-hidden="true" className="h-4 w-4" />
                            </button>
                          ) : null}
                          {canDeletePatients ? (
                            <button
                              className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                              onClick={() => setDeleteCandidate(patient)}
                              title="Delete patient"
                              type="button"
                            >
                              <span className="sr-only">Delete patient</span>
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            onPageChange={setPage}
            totalCount={total}
          />
        </section>
      )}

      {deleteCandidate ? (
        <ConfirmationModal
          body={
            <>
              This will permanently delete{' '}
              <span className="font-semibold text-ink">{deleteCandidate.name}</span>.
            </>
          }
          confirmLabel="Delete Patient"
          isLoading={isDeletingPatient}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={handleDeletePatient}
          title="Delete patient?"
        />
      ) : null}
    </div>
  )
}

export default Patients
