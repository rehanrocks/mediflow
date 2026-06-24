/* src/features/doctors/components/DoctorCard.jsx - Doctor card for list view. */
import { useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Avatar from '@shared/components/Avatar'
import ConfirmationModal from '@shared/components/ConfirmationModal'
import CasesSparkline from '@shared/components/doctors/CasesSparkline'
import DoctorStatusBadge from '@shared/components/doctors/DoctorStatusBadge'
import SpecializationChip from '@shared/components/doctors/SpecializationChip'
import { useToast } from '@shared/components/Toast'
import { useAuth } from '@shared/context/AuthContext'
import { canDeleteDoctor, canEditDoctor } from '@shared/lib/permissions'
import { formatShiftTime } from '@shared/lib/doctorUtils'
import { getBackendError } from '@shared/lib/records'
import { deleteDoctor } from '@shared/services/api'

function StatBlock({ context, label, value }) {
  return (
    <div className="text-center">
      <p className="text-[11px] font-normal uppercase tracking-wide text-slate/70">
        {label}
      </p>
      <p className="mt-1 font-mono text-[18px] font-bold text-ink">{value}</p>
      <p className="text-[11px] font-normal text-slate">{context}</p>
    </div>
  )
}

export function DoctorCard({ doctor, onDelete }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const canEdit = canEditDoctor(user)
  const canDelete = canDeleteDoctor(user)
  const avgCases = Number.isFinite(Number(doctor.avg_cases_per_day))
    ? Number(doctor.avg_cases_per_day).toFixed(1)
    : '-'

  function handleCardClick() {
    navigate(`/doctors/${doctor.id}`)
  }

  function handleEdit(event) {
    event.stopPropagation()
    setShowMenu(false)
    navigate(`/doctors/${doctor.id}/edit`)
  }

  function handleDeleteClick(event) {
    event.stopPropagation()
    setShowMenu(false)
    setShowDeleteModal(true)
  }

  async function handleConfirmDelete() {
    setIsDeleting(true)

    try {
      await deleteDoctor(doctor.id)
      toast.success('Doctor deleted.')
      setShowDeleteModal(false)
      onDelete?.(doctor.id)
    } catch (error) {
      toast.error(getBackendError(error, 'Doctor could not be deleted.'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <article
        className={[
          'animate-fade-up cursor-pointer rounded-card bg-canvas p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_24px_rgba(20,24,31,0.08)]',
          doctor.status === 'inactive' ? 'opacity-60' : '',
        ].join(' ')}
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar name={doctor.full_name} size="lg" />
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-semibold text-ink">
                {doctor.full_name || 'Unnamed doctor'}
              </h3>
              <p className="mt-0.5 truncate text-[12px] font-normal text-slate">
                {doctor.qualification || 'Qualification not specified'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DoctorStatusBadge status={doctor.status} />

            {canEdit ? (
              <div className="relative">
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-control text-slate transition hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                  onClick={(event) => {
                    event.stopPropagation()
                    setShowMenu((open) => !open)
                  }}
                  title="Doctor actions"
                  type="button"
                >
                  <span className="sr-only">Doctor actions</span>
                  <MoreVertical aria-hidden="true" className="h-4 w-4" />
                </button>

                {showMenu ? (
                  <div
                    className="absolute right-0 top-full z-20 mt-1 min-w-[130px] overflow-hidden rounded-control border border-hairline bg-canvas shadow-card animate-scale-in"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      className="flex w-full items-center gap-2 border-b border-hairline px-3 py-2 text-left text-[13px] font-medium text-ink transition hover:bg-mist"
                      onClick={handleEdit}
                      type="button"
                    >
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    {canDelete ? (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-rose-600 transition hover:bg-rose-50"
                        onClick={handleDeleteClick}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {doctor.specializations?.length > 0 ? (
          <div className="mt-3">
            <SpecializationChip specializations={doctor.specializations} />
          </div>
        ) : null}

        <div className="mt-3 border-t border-hairline pt-3">
          <div className="grid grid-cols-3 gap-4">
            <StatBlock
              context="cases"
              label="Today"
              value={doctor.cases_today ?? 0}
            />
            <StatBlock context="cases" label="Avg/Day" value={avgCases} />
            <StatBlock
              context="yrs"
              label="Experience"
              value={doctor.experience_years ?? 0}
            />
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate/70">
            7-day case trend
          </p>
          <CasesSparkline data={doctor.daily_cases || []} height={44} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline pt-3">
          <span className="text-[13px] font-medium text-brand">View Details -&gt;</span>
          <span className="shrink-0 font-mono text-[11px] text-slate">
            {formatShiftTime(doctor.shift_start)} - {formatShiftTime(doctor.shift_end)}
          </span>
        </div>
      </article>

      {showDeleteModal ? (
        <ConfirmationModal
          body={
            <>
              This will delete{' '}
              <span className="font-semibold text-ink">{doctor.full_name}</span>
              's profile from the doctors module.
            </>
          }
          confirmLabel="Delete Doctor"
          isLoading={isDeleting}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleConfirmDelete}
          title="Delete doctor?"
        />
      ) : null}
    </>
  )
}

export default DoctorCard
