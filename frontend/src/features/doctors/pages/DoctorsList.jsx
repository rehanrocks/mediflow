/* src/features/doctors/pages/DoctorsList.jsx - Doctors table page with filters and stats. */
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CalendarOff,
  ClipboardList,
  Eye,
  Pencil,
  Search,
  SearchX,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Avatar from '@shared/components/Avatar'
import ConfirmationModal from '@shared/components/ConfirmationModal'
import Pagination from '@shared/components/Pagination'
import SkeletonRow from '@shared/components/SkeletonRow'
import DoctorStatusBadge from '@shared/components/doctors/DoctorStatusBadge'
import SpecializationChip from '@shared/components/doctors/SpecializationChip'
import { useToast } from '@shared/components/Toast'
import useDebounce from '@shared/hooks/useDebounce'
import { useCountUp } from '@shared/lib/countUp'
import { stagger } from '@shared/lib/motion'
import {
  PAGE_SIZE,
  normalizePaginatedResponse,
  pageParams,
} from '@shared/lib/pagination'
import { usePermission } from '@shared/lib/usePermission'
import { getBackendError, getDoctorName } from '@shared/lib/records'
import { formatShiftRange, formatShiftTime } from '@shared/lib/timeUtils'
import { deleteDoctor, getDoctors } from '@shared/services/api'

const STATUS_OPTIONS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['on_leave', 'On Leave'],
  ['inactive', 'Inactive'],
]

const STAT_TONES = {
  appointments: 'bg-brand-light text-brand',
  cases: 'bg-rose-50 text-rose-600',
  doctors: 'bg-violet-50 text-violet-600',
  staff: 'bg-amber-50 text-amber-600',
  teal: 'bg-teal-50 text-teal-600',
}

function StatCard({ context, icon: Icon, index, label, tone = 'doctors', value }) {
  const displayValue = useCountUp(value)

  return (
    <section
      className="animate-fade-up rounded-card border border-hairline bg-canvas p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,24,31,0.07)]"
      style={stagger(index, 0.06)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[36px] font-bold leading-none text-ink">{displayValue}</p>
          <p className="mt-3 text-[13px] font-medium text-ink">{label}</p>
          <p className="mt-1 text-[12px] font-normal text-slate">{context}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${STAT_TONES[tone]}`}>
          <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
        </div>
      </div>
    </section>
  )
}

function IconButton({ children, label, onClick, tone = 'blue' }) {
  const toneClass =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 focus-visible:ring-rose-300'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-300'
        : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:ring-blue-300'

  return (
    <button
      className={[
        'rounded-lg border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2',
        toneClass,
      ].join(' ')}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span className="sr-only">{label}</span>
      {children}
    </button>
  )
}

function QualificationChips({ qualifications = [] }) {
  const values = qualifications
    .map((qualification) =>
      typeof qualification === 'object' ? qualification.name : qualification,
    )
    .filter(Boolean)
  const visible = values.slice(0, 2)
  const remaining = Math.max(values.length - visible.length, 0)

  if (values.length === 0) {
    return <span className="text-[12px] text-slate/50">-</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((qualification) => (
        <span
          className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
          key={qualification}
        >
          {qualification}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="text-[11px] font-medium text-slate">+{remaining} more</span>
      ) : null}
    </div>
  )
}

function formatArrival(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  return formatShiftTime(value)
}

export function DoctorsList() {
  const navigate = useNavigate()
  const toast = useToast()
  const { canDelete: canDeleteRecords, canWrite, isAdmin } = usePermission()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [doctors, setDoctors] = useState([])
  const [total, setTotal] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const debouncedSearch = useDebounce(searchQuery, 300)

  const canCreateDoctor = isAdmin
  const canEdit = isAdmin
  const canDelete = canDeleteRecords()
  const hasActiveFilters = debouncedSearch.trim() || statusFilter !== 'all'

  useEffect(() => {
    let mounted = true

    async function fetchDoctors() {
      setIsLoading(true)
      setLoadError('')
      setDoctors([])

      try {
        const response = await getDoctors({
          ...pageParams(page),
          ordering: '-created_at',
          ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        })
        const normalized = normalizePaginatedResponse(response)

        if (mounted) {
          setDoctors(normalized.results)
          setTotal(normalized.count)
        }
      } catch (error) {
        if (mounted) {
          const message = getBackendError(error, 'Doctors could not be loaded.')
          setLoadError(message)
          toast.error(message)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchDoctors()

    return () => {
      mounted = false
    }
  }, [debouncedSearch, page, statusFilter, toast])

  const stats = useMemo(
    () => ({
      active: doctors.filter((doctor) => doctor.status === 'active').length,
      casesToday: doctors.reduce(
        (sum, doctor) => sum + Number(doctor.cases_today || 0),
        0,
      ),
      onLeave: doctors.filter((doctor) => doctor.status === 'on_leave').length,
      total,
    }),
    [doctors, total],
  )

  function handleResetFilters() {
    setSearchQuery('')
    setStatusFilter('all')
    setPage(1)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)

    try {
      await deleteDoctor(deleteTarget.id)
      toast.success('Doctor deleted.')
      setDeleteTarget(null)
      setDoctors((currentDoctors) =>
        currentDoctors.filter((doctor) => String(doctor.id) !== String(deleteTarget.id)),
      )
      setTotal((currentTotal) => Math.max(currentTotal - 1, 0))
    } catch (error) {
      toast.error(getBackendError(error, 'Doctor could not be deleted.'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-end">
        {canCreateDoctor ? (
          <button
            className="primary-button inline-flex h-10 items-center rounded-control bg-brand px-4 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            onClick={() => navigate('/doctors/new')}
            type="button"
          >
            <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
            Add Doctor
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          context="in the system"
          icon={Users}
          index={0}
          label="Total Doctors"
          tone="doctors"
          value={stats.total}
        />
        <StatCard
          context="checked in or active"
          icon={Activity}
          index={1}
          label="Active Today"
          tone="teal"
          value={stats.active}
        />
        <StatCard
          context="returning later"
          icon={CalendarOff}
          index={2}
          label="On Leave"
          tone="staff"
          value={stats.onLeave}
        />
        <StatCard
          context="this page"
          icon={ClipboardList}
          index={3}
          label="Cases Today"
          tone="cases"
          value={stats.casesToday}
        />
      </div>

      <section className="flex flex-col gap-3 rounded-card bg-canvas px-4 py-3 shadow-card xl:flex-row xl:items-center">
        <label className="relative flex min-w-[240px] flex-1 items-center gap-2 rounded-control bg-mist px-3 py-2">
          <span className="sr-only">Search doctors</span>
          <Search aria-hidden="true" className="h-4 w-4 text-slate" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-slate/50"
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search by name, email, qualification..."
            type="search"
            value={searchQuery}
          />
          {searchQuery ? (
            <button
              className="rounded-md p-1 text-slate transition hover:bg-hairline hover:text-ink"
              onClick={() => {
                setSearchQuery('')
                setPage(1)
              }}
              type="button"
            >
              <span className="sr-only">Clear doctor search</span>
              <X aria-hidden="true" className="h-[14px] w-[14px]" />
            </button>
          ) : null}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map(([status, label]) => (
            <button
              className={[
                'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all',
                statusFilter === status
                  ? 'border-brand/30 bg-brand-light text-brand'
                  : 'border-hairline bg-mist text-slate hover:border-slate/30 hover:text-ink',
              ].join(' ')}
              key={status}
              onClick={() => {
                setStatusFilter(status)
                setPage(1)
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {loadError ? (
        <section className="rounded-card bg-canvas p-10 text-center shadow-card">
          <SearchX aria-hidden="true" className="mx-auto mb-3 h-9 w-9 text-slate/30" />
          <p className="text-[16px] font-semibold text-ink">
            Something went wrong
          </p>
          <p className="mt-1 text-[13px] text-slate">{loadError}</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-card bg-canvas shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] border-collapse text-left">
              <thead className="border-b border-hairline bg-mist">
                <tr>
                  {[
                    'Doctor',
                    'Specializations',
                    'Qualifications',
                    'Experience',
                    'Shift',
                    'Arrived Today',
                    'Cases Today',
                    'Status',
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
                    <SkeletonRow columns={9} index={index} key={index} />
                  ))
                ) : doctors.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center" colSpan={9}>
                      {hasActiveFilters ? (
                        <>
                          <SearchX aria-hidden="true" className="mx-auto mb-3 h-9 w-9 text-slate/30" />
                          <h2 className="text-[16px] font-semibold text-ink">No doctors found</h2>
                          <p className="mt-1 text-[13px] text-slate">
                            Try adjusting your search or filters
                          </p>
                          <button
                            className="mt-3 text-[13px] font-medium text-brand transition hover:text-brand-dark"
                            onClick={handleResetFilters}
                            type="button"
                          >
                            Clear filters
                          </button>
                        </>
                      ) : (
                        <>
                          <UserPlus aria-hidden="true" className="mx-auto mb-4 h-11 w-11 text-brand/20" />
                          <h2 className="text-[18px] font-semibold text-ink">
                            No doctors added yet
                          </h2>
                          <p className="mt-1 text-[14px] text-slate">
                            Add your first doctor to get started
                          </p>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  doctors.map((doctor, index) => {
                    const doctorName = getDoctorName(doctor)

                    return (
                      <tr
                        className="animate-fade-up border-b border-hairline transition-colors duration-100 last:border-0 hover:bg-brand-light/40"
                        key={doctor.id}
                        style={stagger(index, 0.03)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={doctorName} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-ink">
                                {doctorName}
                              </p>
                              <p className="truncate font-sans text-[11px] text-slate">
                                {doctor.email || '-'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <SpecializationChip specializations={doctor.specializations?.slice(0, 2) || []} />
                          {doctor.specializations?.length > 2 ? (
                            <span className="text-[11px] font-medium text-slate">
                              +{doctor.specializations.length - 2} more
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          <QualificationChips
                            qualifications={
                              doctor.qualifications?.length
                                ? doctor.qualifications
                                : String(doctor.qualification || '')
                                    .split(',')
                                    .map((qualification) => qualification.trim())
                                    .filter(Boolean)
                            }
                          />
                        </td>
                        <td className="px-5 py-4 font-sans text-[13px] text-ink">
                          {doctor.experience_years ?? 0} yrs
                        </td>
                        <td className="px-5 py-4 font-sans text-[12px] text-slate">
                          {formatShiftRange(doctor.shift_start, doctor.shift_end)}
                        </td>
                        <td className="px-5 py-4 font-sans text-[12px] text-slate">
                          {formatArrival(doctor.today_checkin)}
                        </td>
                        <td className="px-5 py-4 font-sans text-[13px] font-medium text-ink">
                          {Number(doctor.cases_today || 0)}
                        </td>
                        <td className="px-5 py-4">
                          <DoctorStatusBadge status={doctor.status} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <IconButton
                              label="View doctor"
                              onClick={() => navigate(`/doctors/${doctor.id}`)}
                            >
                              <Eye aria-hidden="true" className="h-4 w-4" />
                            </IconButton>
                            {canEdit ? (
                              <IconButton
                                label="Edit doctor"
                                onClick={() => navigate(`/doctors/${doctor.id}/edit`)}
                                tone="amber"
                              >
                                <Pencil aria-hidden="true" className="h-4 w-4" />
                              </IconButton>
                            ) : null}
                            {canDelete ? (
                              <IconButton
                                label="Delete doctor"
                                onClick={() => setDeleteTarget(doctor)}
                                tone="rose"
                              >
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </IconButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })
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

      {deleteTarget ? (
        <ConfirmationModal
          body={
            <>
              This will delete{' '}
              <span className="font-semibold text-ink">{getDoctorName(deleteTarget)}</span>
              's profile from the doctors module.
            </>
          }
          confirmLabel="Delete Doctor"
          isLoading={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title="Delete doctor?"
        />
      ) : null}
    </div>
  )
}

export default DoctorsList
