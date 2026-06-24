/* src/features/staff/pages/StaffList.jsx - Staff directory page. */
import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  BriefcaseBusiness,
  Eye,
  IdCardLanyard,
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
import { useToast } from '@shared/components/Toast'
import RoleBadge from '@shared/components/staff/RoleBadge'
import StaffStatusBadge from '@shared/components/staff/StaffStatusBadge'
import useDebounce from '@shared/hooks/useDebounce'
import { useCountUp } from '@shared/lib/countUp'
import { stagger } from '@shared/lib/motion'
import {
  PAGE_SIZE,
  normalizePaginatedResponse,
  pageParams,
} from '@shared/lib/pagination'
import { usePermission } from '@shared/lib/usePermission'
import { getBackendError } from '@shared/lib/records'
import {
  computeTenure,
  extractUniqueRoles,
  getStaffAgeError,
  getStaffCreatedDateError,
  getStaffDataIssues,
  getStaffJoiningDateError,
} from '@shared/lib/staffUtils'
import { formatShiftRange } from '@shared/lib/timeUtils'
import { deleteStaff, getStaff } from '@shared/services/api'

const STATUS_OPTIONS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['inactive', 'Inactive'],
]

function formatJoinedMonth(value) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const STAT_TONES = {
  brand: 'border-brand/10 bg-brand-light text-brand',
  green: 'border-green-200 bg-green-50 text-green-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
}

function StatCard({ context, icon: Icon, label, tone = 'brand', value }) {
  const displayValue = useCountUp(value)
  const toneClass = STAT_TONES[tone] || STAT_TONES.brand

  return (
    <section className="rounded-card border border-hairline/70 bg-canvas p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,24,31,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[36px] font-bold leading-none text-ink">
            {displayValue}
          </p>
          <p className="mt-3 text-[13px] font-medium text-ink">{label}</p>
          <p className="mt-1 text-[12px] font-normal text-slate">{context}</p>
        </div>
        <div className={['flex h-10 w-10 items-center justify-center rounded-xl border', toneClass].join(' ')}>
          <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
        </div>
      </div>
    </section>
  )
}

function IconButton({ children, label, onClick, tone = 'slate' }) {
  const toneClass =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
      : tone === 'brand'
        ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
        : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'

  return (
    <button
      className={[
        'inline-flex h-10 w-10 items-center justify-center rounded-control border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
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

export function StaffList() {
  const navigate = useNavigate()
  const toast = useToast()
  const { canWrite } = usePermission()
  const [staff, setStaff] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const debouncedSearch = useDebounce(searchQuery, 300)
  const canManage = canWrite('staff')
  const hasActiveFilters =
    debouncedSearch.trim() || statusFilter !== 'all' || roleFilter !== 'all'

  useEffect(() => {
    let mounted = true

    async function fetchStaff() {
      setIsLoading(true)
      setLoadError('')
      setStaff([])

      try {
        const params = {
          ...pageParams(page),
          ordering: '-joining_date',
          ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        }
        const response = await getStaff(params)
        const normalized = normalizePaginatedResponse(response)

        if (mounted) {
          setStaff(normalized.results)
          setTotal(normalized.count)
        }
      } catch (error) {
        if (mounted) {
          const message = getBackendError(error, 'Staff could not be loaded.')
          setLoadError(message)
          toast.error(message)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchStaff()

    return () => {
      mounted = false
    }
  }, [debouncedSearch, page, statusFilter, toast])

  const uniqueRoles = useMemo(() => extractUniqueRoles(staff), [staff])

  const filteredStaff = useMemo(() => {
    return staff.filter(
      (staffMember) => roleFilter === 'all' || staffMember.role === roleFilter,
    )
  }, [roleFilter, staff])

  const stats = useMemo(
    () => ({
      active: staff.filter((staffMember) => staffMember.status === 'active').length,
      roles: extractUniqueRoles(staff).length,
      total,
    }),
    [staff, total],
  )

  function handleResetFilters() {
    setSearchQuery('')
    setStatusFilter('all')
    setRoleFilter('all')
    setPage(1)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)

    try {
      await deleteStaff(deleteTarget.id)
      setStaff((currentStaff) =>
        currentStaff.filter(
          (staffMember) => String(staffMember.id) !== String(deleteTarget.id),
        ),
      )
      toast.success('Staff member removed')
      setDeleteTarget(null)
    } catch (error) {
      toast.error(getBackendError(error, 'Staff member could not be deleted.'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate">
            Operations
          </p>
          <p className="mt-1 text-[14px] text-slate">
            {filteredStaff.length} visible from {total} records
          </p>
        </div>
        {canManage ? (
          <button
            className="primary-button inline-flex h-10 items-center justify-center rounded-control bg-brand px-4 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            onClick={() => navigate('/staff/new')}
            type="button"
          >
            <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
            Add Staff
          </button>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          context="registered"
          icon={IdCardLanyard}
          label="Total Staff"
          tone="brand"
          value={stats.total}
        />
        <StatCard
          context="currently working"
          icon={BadgeCheck}
          label="Active"
          tone="green"
          value={stats.active}
        />
        <StatCard
          context="across all staff"
          icon={BriefcaseBusiness}
          label="Unique Roles"
          tone="amber"
          value={stats.roles}
        />
      </div>

      <section className="mb-4 flex flex-col gap-3 rounded-card border border-hairline/70 bg-canvas px-4 py-3 shadow-card xl:flex-row xl:items-center">
        <label className="relative flex min-w-[240px] flex-1 items-center gap-2 rounded-control border border-transparent bg-mist px-3 py-2 transition focus-within:border-brand/30 focus-within:bg-canvas focus-within:ring-2 focus-within:ring-brand/15">
          <span className="sr-only">Search staff</span>
          <Search aria-hidden="true" className="h-4 w-4 text-slate" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-slate/50"
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search by name or role..."
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
              <span className="sr-only">Clear staff search</span>
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

        <select
          className="h-[38px] rounded-control border border-hairline bg-mist px-3 text-[13px] font-medium text-ink outline-none transition hover:border-slate/30 focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/15"
          onChange={(event) => {
            setRoleFilter(event.target.value)
            setPage(1)
          }}
          value={roleFilter}
        >
          <option value="all">All Roles</option>
          {uniqueRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </section>

      {loadError ? (
        <section className="rounded-card bg-canvas p-10 text-center shadow-card">
          <SearchX aria-hidden="true" className="mx-auto mb-3 h-9 w-9 text-slate/30" />
          <p className="text-[16px] font-semibold text-ink">
            Something went wrong
          </p>
          <p className="mt-1 text-[13px] text-slate">{loadError}</p>
        </section>
      ) : isLoading ? (
        <section className="overflow-hidden rounded-card border border-hairline/70 bg-canvas shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full">
              <tbody>
                {Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <SkeletonRow columns={7} index={index} key={index} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : filteredStaff.length === 0 ? (
        <section className="rounded-card border border-hairline/70 bg-canvas px-6 py-12 text-center shadow-card">
          {staff.length === 0 && !hasActiveFilters ? (
            <>
              <Users aria-hidden="true" className="mx-auto mb-4 h-11 w-11 text-brand/20" />
              <h2 className="text-[18px] font-semibold text-ink">
                No staff added yet
              </h2>
              <p className="mt-1 text-[14px] text-slate">
                Add your first staff member to get started
              </p>
              {canManage ? (
                <button
                  className="primary-button mx-auto mt-4 inline-flex h-10 items-center rounded-control bg-brand px-4 text-[13px] font-semibold text-white"
                  onClick={() => navigate('/staff/new')}
                  type="button"
                >
                  <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
                  Add Staff
                </button>
              ) : null}
            </>
          ) : (
            <>
              <SearchX aria-hidden="true" className="mx-auto mb-3 h-9 w-9 text-slate/30" />
              <h2 className="text-[16px] font-semibold text-ink">No staff found</h2>
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
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-card border border-hairline/70 bg-canvas shadow-card">
          <div className="flex flex-col gap-1 border-b border-hairline bg-canvas px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-ink">Staff Directory</h2>
              <p className="mt-0.5 text-[12px] text-slate">
                {filteredStaff.length} records in view
              </p>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-wide text-slate">
              {statusFilter === 'all' ? 'All statuses' : statusFilter}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full">
              <thead className="border-b border-hairline bg-mist/90">
                <tr>
                {['Name', 'Role', 'Age', 'Joined', 'Shift', 'Status', 'Actions'].map(
                    (heading) => (
                      <th
                        className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-slate"
                        key={heading}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline bg-canvas">
                {filteredStaff.map((staffMember, index) => {
                  const ageIssue = getStaffAgeError(staffMember.age)
                  const joiningIssue =
                    getStaffJoiningDateError(
                      staffMember.age,
                      staffMember.joining_date,
                    ) ||
                    getStaffCreatedDateError(
                      staffMember.joining_date,
                      staffMember.created_at,
                    )
                  const hasIssues = getStaffDataIssues(staffMember).length > 0

                  return (
                    <tr
                      className={[
                        'group align-middle transition-colors duration-100',
                        hasIssues
                          ? 'bg-rose-50/30 hover:bg-rose-50/60'
                          : 'hover:bg-brand-light/40',
                      ].join(' ')}
                      key={staffMember.id}
                      style={stagger(index, 0.03)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={staffMember.full_name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-ink">
                              {staffMember.full_name}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-slate">
                              {staffMember.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <RoleBadge role={staffMember.role} />
                      </td>
                      <td className="px-5 py-4">
                        {ageIssue ? (
                          <>
                            <p className="text-[13px] font-semibold text-rose-600">
                              Needs review
                            </p>
                            <p className="mt-1 font-mono text-[11px] text-slate">
                              Recorded: {staffMember.age}
                            </p>
                          </>
                        ) : (
                          <p className="font-mono text-[13px] text-ink">
                            {staffMember.age} yrs
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {joiningIssue ? (
                          <>
                            <p className="text-[13px] font-semibold text-rose-600">
                              Check date
                            </p>
                            <p className="mt-1 font-mono text-[11px] text-slate">
                              {formatJoinedMonth(staffMember.joining_date)}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-mono text-[12px] text-ink">
                              {formatJoinedMonth(staffMember.joining_date)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate">
                              {computeTenure(staffMember.joining_date)}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-[12px] text-slate">
                        {formatShiftRange(staffMember.shift_start, staffMember.shift_end)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <StaffStatusBadge status={staffMember.status} />
                          {hasIssues ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                              Data check
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 opacity-80 transition group-hover:opacity-100">
                          <IconButton
                            label="View staff member"
                            onClick={() => navigate(`/staff/${staffMember.id}`)}
                          >
                            <Eye aria-hidden="true" className="h-4 w-4" />
                          </IconButton>
                          {canManage ? (
                            <>
                              <IconButton
                                label="Edit staff member"
                                onClick={() => navigate(`/staff/${staffMember.id}/edit`)}
                                tone="brand"
                              >
                                <Pencil aria-hidden="true" className="h-4 w-4" />
                              </IconButton>
                              <IconButton
                                label="Delete staff member"
                                onClick={() => setDeleteTarget(staffMember)}
                                tone="rose"
                              >
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </IconButton>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
              This action cannot be undone.{' '}
              <span className="font-semibold text-ink">
                {deleteTarget.full_name}
              </span>
              's record will be permanently removed.
            </>
          }
          confirmLabel="Delete"
          isLoading={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Staff Member?"
        />
      ) : null}
    </div>
  )
}

export default StaffList
