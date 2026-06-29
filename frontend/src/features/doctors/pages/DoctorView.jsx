/* src/features/doctors/pages/DoctorView.jsx - Doctor profile page with analytics. */
import { useEffect, useState } from 'react'
import {
  Archive,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ClipboardList,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'

import AppointmentsTable from '@features/doctors/components/AppointmentsTable'
import CasesPerDayChart from '@features/doctors/components/CasesPerDayChart'
import CaseTypeBreakdown from '@features/doctors/components/CaseTypeBreakdown'
import ProfileHeaderCard from '@features/doctors/components/ProfileHeaderCard'
import ConfirmationModal from '@shared/components/ConfirmationModal'
import SkeletonRow from '@shared/components/SkeletonRow'
import { useToast } from '@shared/components/Toast'
import { useCountUp } from '@shared/lib/countUp'
import { getBackendError, getDoctorName } from '@shared/lib/records'
import { usePermission } from '@shared/lib/usePermission'
import { deleteDoctor, getDoctorById, getDoctorStats } from '@shared/services/api'

function StatCard({ context, icon: Icon, label, value }) {
  const displayValue = useCountUp(value)

  return (
    <section className="rounded-card bg-canvas p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate">
            {label}
          </p>
          <p className="mt-2 font-sans text-[30px] font-bold text-ink">
            {displayValue}
          </p>
          <p className="mt-1 text-[12px] text-slate">{context}</p>
        </div>
        <div className="rounded-lg bg-brand/10 p-2 text-brand">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
      </div>
    </section>
  )
}

export function DoctorView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { clearPageMeta, setPageMeta } = useOutletContext()
  const {
    canDelete: canDeleteRecords,
    canViewFullDoctorProfile,
    isAdmin,
    isOwnDoctorProfile,
  } = usePermission()
  const [doctor, setDoctor] = useState(null)
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const canEdit = isAdmin
  const canDelete = canDeleteRecords()
  const canViewFull = canViewFullDoctorProfile(doctor?.id ?? id)
  const ownProfile = isOwnDoctorProfile(doctor?.id ?? id)

  useEffect(() => {
    let mounted = true

    async function fetchDoctorProfile() {
      setIsLoading(true)
      setNotFound(false)
      setStats(null)

      try {
        const doctorData = await getDoctorById(id)

        if (!mounted) return

        setDoctor(doctorData)

        if (canViewFullDoctorProfile(doctorData.id)) {
          try {
            const statsData = await getDoctorStats(id)

            if (mounted) {
              setStats(statsData)
            }
          } catch (statsError) {
            if (mounted) {
              toast.error(getBackendError(statsError, 'Doctor stats could not be loaded.'))
            }
          }
        }
      } catch (error) {
        if (!mounted) return

        setDoctor(null)
        setNotFound(true)

        if (error?.response?.status !== 404) {
          toast.error(getBackendError(error, 'Doctor profile could not be loaded.'))
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchDoctorProfile()

    return () => {
      mounted = false
    }
  }, [canViewFullDoctorProfile, id, toast])

  useEffect(() => {
    if (!doctor) return undefined

    setPageMeta({
      title: getDoctorName(doctor),
      subtitle: doctor.specializations?.[0] || doctor.qualification || 'Doctor profile',
    })

    return clearPageMeta
  }, [clearPageMeta, doctor, setPageMeta])

  async function handleConfirmDelete() {
    setIsDeleting(true)

    try {
      await deleteDoctor(id)
      toast.success('Doctor deleted.')
      navigate('/doctors')
    } catch (error) {
      toast.error(getBackendError(error, 'Doctor could not be deleted.'))
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-card bg-canvas p-6 shadow-card">
          <div className="mb-5 h-10 w-48 rounded-full bg-hairline animate-pulse" />
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonRow index={index} key={index} variant="form" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonRow index={index} key={index} variant="stat" />
          ))}
        </div>
      </div>
    )
  }

  if (notFound || !doctor) {
    return (
      <div className="space-y-5">
        <button
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-dark"
          onClick={() => navigate('/doctors')}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Back to doctors
        </button>
        <section className="rounded-card bg-canvas p-12 text-center shadow-card">
          <p className="text-[16px] font-semibold text-ink">Doctor not found</p>
          <p className="mt-1 text-[13px] text-slate">
            This doctor profile does not exist or has been deleted.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-dark"
          onClick={() => navigate('/doctors')}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Back to doctors
        </button>

        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <button
              className="inline-flex h-9 items-center rounded-control border border-brand/20 bg-brand-light px-3 text-[13px] font-semibold text-brand transition hover:border-brand/40"
              onClick={() => navigate(`/doctors/${id}/edit`)}
              type="button"
            >
              <Pencil aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </button>
          ) : ownProfile ? (
            <button
              className="inline-flex h-9 cursor-not-allowed items-center rounded-control border border-hairline bg-mist px-3 text-[13px] font-semibold text-slate opacity-70"
              disabled
              title="Contact admin to update your profile"
              type="button"
            >
              <Pencil aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Edit Profile
            </button>
          ) : null}

          {canDelete ? (
            <button
              className="inline-flex h-9 items-center rounded-control border border-rose-200 bg-rose-50 px-3 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-100"
              onClick={() => setDeleteOpen(true)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <ProfileHeaderCard doctor={doctor} />

      {canViewFull ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            context="appointments"
            icon={ClipboardList}
            label="Cases Today"
            value={doctor.cases_today || 0}
          />
          <StatCard
            context="cases"
            icon={CalendarDays}
            label="This Week"
            value={doctor.cases_this_week || 0}
          />
          <StatCard
            context="cases"
            icon={CalendarRange}
            label="This Month"
            value={doctor.cases_this_month || 0}
          />
          <StatCard
            context="career total"
            icon={Archive}
            label="Total Cases"
            value={doctor.total_cases || 0}
          />
        </div>
      ) : (
        <section className="rounded-card border border-brand/10 bg-brand-light px-5 py-4 text-[14px] font-medium text-brand shadow-card">
          Contact admin for performance data
        </section>
      )}

      {canViewFull ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <CaseTypeBreakdown caseTypesData={stats?.case_types || []} />
            <CasesPerDayChart
              avgCasesPerDay={doctor.avg_cases_per_day || 0}
              dailyCasesData={stats?.daily_cases || []}
              monthlySummaryData={stats?.monthly_summary || []}
            />
          </div>

          <AppointmentsTable doctorId={id} />
        </>
      ) : null}

      {deleteOpen ? (
        <ConfirmationModal
          body={
            <>
              This will delete{' '}
              <span className="font-semibold text-ink">{getDoctorName(doctor)}</span>
              's profile from the doctors module.
            </>
          }
          confirmLabel="Delete Doctor"
          isLoading={isDeleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Delete doctor?"
        />
      ) : null}
    </div>
  )
}

export default DoctorView
