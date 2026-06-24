/* src/features/staff/pages/StaffView.jsx - Staff member detail page. */
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  Pencil,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'

import Avatar from '@shared/components/Avatar'
import ConfirmationModal from '@shared/components/ConfirmationModal'
import SkeletonRow from '@shared/components/SkeletonRow'
import { useToast } from '@shared/components/Toast'
import RoleBadge from '@shared/components/staff/RoleBadge'
import StaffStatusBadge from '@shared/components/staff/StaffStatusBadge'
import { useAuth } from '@shared/context/AuthContext'
import { stagger } from '@shared/lib/motion'
import { canManageStaff, canViewStaff } from '@shared/lib/permissions'
import { formatDate, formatDateTime, getBackendError } from '@shared/lib/records'
import {
  computeTenure,
  getStaffAgeError,
  getStaffCreatedDateError,
  getStaffDataIssues,
  getStaffJoiningDateError,
} from '@shared/lib/staffUtils'
import { deleteStaff, getStaffById } from '@shared/services/api'

function DetailItem({ children, label }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

export function StaffView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { clearPageMeta, setPageMeta } = useOutletContext()
  const { user } = useAuth()
  const [staffMember, setStaffMember] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const canManage = canManageStaff(user)
  const notes = String(staffMember?.notes || '').trim()
  const dataIssues = staffMember ? getStaffDataIssues(staffMember) : []
  const ageIssue = staffMember ? getStaffAgeError(staffMember.age) : ''
  const joiningIssue = staffMember
    ? getStaffJoiningDateError(staffMember.age, staffMember.joining_date)
    : ''
  const createdIssue = staffMember
    ? getStaffCreatedDateError(staffMember.joining_date, staffMember.created_at)
    : ''

  useEffect(() => {
    if (!canViewStaff(user)) {
      navigate('/not-available', { replace: true })
    }
  }, [navigate, user])

  useEffect(() => {
    let mounted = true

    async function fetchStaffMember() {
      setIsLoading(true)
      setNotFound(false)

      try {
        const response = await getStaffById(id)

        if (mounted) {
          setStaffMember(response)
        }
      } catch (error) {
        if (!mounted) return

        setStaffMember(null)
        setNotFound(true)

        if (error?.response?.status !== 404) {
          toast.error(getBackendError(error, 'Staff member could not be loaded.'))
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchStaffMember()

    return () => {
      mounted = false
    }
  }, [id, toast])

  useEffect(() => {
    if (!staffMember) return undefined

    setPageMeta({
      title: staffMember.full_name || 'Staff Profile',
      subtitle: (
        <span className="inline-flex items-center gap-2">
          <span className="truncate">{staffMember.role || 'Staff profile'}</span>
          <RoleBadge role={staffMember.role} />
        </span>
      ),
    })

    return clearPageMeta
  }, [clearPageMeta, setPageMeta, staffMember])

  async function handleConfirmDelete() {
    setIsDeleting(true)

    try {
      await deleteStaff(id)
      toast.success('Staff member removed')
      navigate('/staff')
    } catch (error) {
      toast.error(getBackendError(error, 'Staff member could not be deleted.'))
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-card bg-canvas p-6 shadow-card">
          <div className="mb-5 h-10 w-48 rounded-full bg-hairline animate-pulse" />
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonRow index={index} key={index} variant="form" />
          ))}
        </div>
      </div>
    )
  }

  if (notFound || !staffMember) {
    return (
      <div className="space-y-5">
        <button
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-dark"
          onClick={() => navigate('/staff')}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Back to staff
        </button>
        <section className="rounded-card border border-hairline/70 bg-canvas p-12 text-center shadow-card">
          <p className="text-[16px] font-semibold text-ink">
            Staff member not found
          </p>
          <p className="mt-1 text-[13px] text-slate">
            This staff profile does not exist or has been deleted.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-dark"
          onClick={() => navigate('/staff')}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Back to staff
        </button>

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center rounded-control border border-brand/20 bg-brand-light px-3 text-[13px] font-semibold text-brand transition hover:border-brand/40"
              onClick={() => navigate(`/staff/${id}/edit`)}
              type="button"
            >
              <Pencil aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </button>
            <button
              className="inline-flex h-9 items-center rounded-control border border-rose-200 bg-rose-50 px-3 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-100"
              onClick={() => setDeleteOpen(true)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {dataIssues.length > 0 ? (
        <section className="mb-4 flex items-start gap-3 rounded-card border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 shadow-card animate-fade-up">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <div>
            <p className="text-[14px] font-semibold">Staff data needs review</p>
            <p className="mt-1 text-[13px] leading-5">
              {dataIssues.join(' ')} Update this profile before relying on age
              or joining tenure.
            </p>
          </div>
        </section>
      ) : null}

      <section
        className="mb-4 overflow-hidden rounded-card border border-hairline/70 bg-canvas shadow-card animate-fade-up"
        style={stagger(0, 0.05)}
      >
        <div className="flex flex-col gap-4 border-b border-hairline bg-mist/50 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={staffMember.full_name} size="xl" />
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-bold text-ink">
                {staffMember.full_name}
              </h1>
              <div className="mt-1">
                <RoleBadge role={staffMember.role} />
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <StaffStatusBadge status={staffMember.status} />
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <DetailItem label="Phone">
              <p className="font-mono text-[14px] font-semibold text-ink">
                {staffMember.phone || '-'}
              </p>
            </DetailItem>
            <DetailItem label="Age">
              {ageIssue ? (
                <>
                  <p className="text-[14px] font-semibold text-rose-600">
                    Needs review
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate">
                    Recorded value: {staffMember.age}
                  </p>
                </>
              ) : (
                <p className="font-mono text-[14px] font-semibold text-ink">
                  {staffMember.age} yrs
                </p>
              )}
            </DetailItem>
            <DetailItem label="Address">
              <p className="text-[13px] text-slate">
                {staffMember.address || '-'}
              </p>
            </DetailItem>
            <DetailItem label="Joined">
              {joiningIssue || createdIssue ? (
                <>
                  <p className="text-[14px] font-semibold text-rose-600">
                    Check joined date
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate">
                    Recorded: {formatDate(staffMember.joining_date)}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-mono text-[13px] font-semibold text-ink">
                    {formatDate(staffMember.joining_date)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate">
                    {computeTenure(staffMember.joining_date)}
                  </p>
                </>
              )}
            </DetailItem>
            <DetailItem label="Added to system">
              <p className="font-mono text-[11px] text-slate">
                {formatDateTime(staffMember.created_at)}
              </p>
              {createdIssue ? (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  Check against joining date
                </p>
              ) : null}
            </DetailItem>
          </div>
        </div>
      </section>

      {notes ? (
        <section
          className="mb-4 rounded-card border border-hairline/70 bg-canvas p-5 shadow-card animate-fade-up"
          style={stagger(1, 0.05)}
        >
          <h2 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-slate">
            <StickyNote aria-hidden="true" className="h-[14px] w-[14px]" />
            Admin Notes
          </h2>
          <div className="rounded-control bg-mist px-4 py-3">
            <p className="text-[14px] text-ink">
              {notes}
            </p>
          </div>
        </section>
      ) : null}

      {deleteOpen ? (
        <ConfirmationModal
          body={
            <>
              This action cannot be undone.{' '}
              <span className="font-semibold text-ink">
                {staffMember.full_name}
              </span>
              's record will be permanently removed.
            </>
          }
          confirmLabel="Delete"
          isLoading={isDeleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Delete Staff Member?"
        />
      ) : null}
    </div>
  )
}

export default StaffView
