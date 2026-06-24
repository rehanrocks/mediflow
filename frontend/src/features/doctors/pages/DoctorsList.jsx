/* src/features/doctors/pages/DoctorsList.jsx - Doctors list page with filters and stats. */
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CalendarOff,
  ClipboardList,
  Search,
  SearchX,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import DoctorCard from '@features/doctors/components/DoctorCard'
import { useToast } from '@shared/components/Toast'
import { useAuth } from '@shared/context/AuthContext'
import useDebounce from '@shared/hooks/useDebounce'
import { useCountUp } from '@shared/lib/countUp'
import { canAddDoctor } from '@shared/lib/permissions'
import { getBackendError, normalizeList } from '@shared/lib/records'
import { getDoctors } from '@shared/services/api'

const STATUS_OPTIONS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['on_leave', 'On Leave'],
  ['inactive', 'Inactive'],
]

function CardSkeleton() {
  return (
    <div className="rounded-card bg-canvas p-5 shadow-card">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-full bg-hairline animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded-full bg-hairline animate-pulse" />
          <div className="h-3 w-28 rounded-full bg-hairline animate-pulse" />
        </div>
        <div className="h-6 w-20 rounded-full bg-hairline animate-pulse" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="space-y-2" key={index}>
            <div className="mx-auto h-3 w-14 rounded-full bg-hairline animate-pulse" />
            <div className="mx-auto h-6 w-10 rounded-full bg-hairline animate-pulse" />
          </div>
        ))}
      </div>
      <div className="mt-5 h-10 rounded-control bg-hairline animate-pulse" />
    </div>
  )
}

function StatCard({ context, icon: Icon, label, tone = 'brand', value }) {
  const displayValue = useCountUp(value)
  const toneClass =
    tone === 'green'
      ? 'bg-green-100 text-green-600'
      : tone === 'amber'
        ? 'bg-amber-100 text-amber-600'
        : 'bg-brand/10 text-brand'

  return (
    <section className="rounded-card bg-canvas p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate">
            {label}
          </p>
          <p className="mt-2 font-mono text-[32px] font-bold text-ink">
            {displayValue}
          </p>
          <p className="mt-1 text-[12px] text-slate">{context}</p>
        </div>
        <div className={`rounded-lg p-2 ${toneClass}`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
      </div>
    </section>
  )
}

export function DoctorsList() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [specializationFilter, setSpecializationFilter] = useState('all')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const canCreateDoctor = canAddDoctor(user)

  useEffect(() => {
    let mounted = true

    async function fetchDoctors() {
      setIsLoading(true)
      setLoadError('')

      try {
        const params = debouncedSearch.trim()
          ? { search: debouncedSearch.trim() }
          : {}
        const response = await getDoctors(params)

        if (mounted) {
          setDoctors(normalizeList(response))
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
  }, [debouncedSearch, toast])

  const uniqueSpecializations = useMemo(() => {
    const specs = new Set()
    doctors.forEach((doctor) => {
      doctor.specializations?.forEach((spec) => specs.add(spec))
    })
    return Array.from(specs).sort((first, second) => first.localeCompare(second))
  }, [doctors])

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doctor) => {
      const matchesStatus =
        statusFilter === 'all' || doctor.status === statusFilter
      const matchesSpecialization =
        specializationFilter === 'all' ||
        doctor.specializations?.includes(specializationFilter)

      return matchesStatus && matchesSpecialization
    })
  }, [doctors, specializationFilter, statusFilter])

  const stats = useMemo(
    () => ({
      active: doctors.filter((doctor) => doctor.status === 'active').length,
      casesToday: doctors.reduce(
        (sum, doctor) => sum + Number(doctor.cases_today || 0),
        0,
      ),
      onLeave: doctors.filter((doctor) => doctor.status === 'on_leave').length,
      total: doctors.length,
    }),
    [doctors],
  )

  function handleResetFilters() {
    setSearchQuery('')
    setStatusFilter('all')
    setSpecializationFilter('all')
  }

  function handleDoctorDeleted(doctorId) {
    setDoctors((currentDoctors) =>
      currentDoctors.filter((doctor) => String(doctor.id) !== String(doctorId)),
    )
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
          label="Total Doctors"
          value={stats.total}
        />
        <StatCard
          context="on shift"
          icon={Activity}
          label="Active Today"
          tone="green"
          value={stats.active}
        />
        <StatCard
          context="returning today"
          icon={CalendarOff}
          label="On Leave"
          tone="amber"
          value={stats.onLeave}
        />
        <StatCard
          context="across all doctors"
          icon={ClipboardList}
          label="Cases Today"
          value={stats.casesToday}
        />
      </div>

      <section className="flex flex-col gap-3 rounded-card bg-canvas px-4 py-3 shadow-card xl:flex-row xl:items-center">
        <label className="relative flex min-w-[240px] flex-1 items-center gap-2 rounded-control bg-mist px-3 py-2">
          <span className="sr-only">Search doctors</span>
          <Search aria-hidden="true" className="h-4 w-4 text-slate" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-slate/50"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or specialization..."
            type="search"
            value={searchQuery}
          />
          {searchQuery ? (
            <button
              className="rounded-md p-1 text-slate transition hover:bg-hairline hover:text-ink"
              onClick={() => setSearchQuery('')}
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
              onClick={() => setStatusFilter(status)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <select
          className="h-[38px] rounded-control border border-hairline bg-mist px-3 text-[13px] font-medium text-ink outline-none transition focus:border-brand"
          onChange={(event) => setSpecializationFilter(event.target.value)}
          value={specializationFilter}
        >
          <option value="all">All Specializations</option>
          {uniqueSpecializations.map((spec) => (
            <option key={spec} value={spec}>
              {spec}
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : filteredDoctors.length === 0 ? (
        <section className="rounded-card bg-canvas px-6 py-12 text-center shadow-card">
          {doctors.length === 0 ? (
            <>
              <UserPlus aria-hidden="true" className="mx-auto mb-4 h-11 w-11 text-brand/20" />
              <h2 className="text-[18px] font-semibold text-ink">
                No doctors added yet
              </h2>
              <p className="mt-1 text-[14px] text-slate">
                Add your first doctor to get started
              </p>
              {canCreateDoctor ? (
                <button
                  className="primary-button mx-auto mt-4 inline-flex h-10 items-center rounded-control bg-brand px-4 text-[13px] font-semibold text-white"
                  onClick={() => navigate('/doctors/new')}
                  type="button"
                >
                  <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
                  Add Doctor
                </button>
              ) : null}
            </>
          ) : (
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
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredDoctors.map((doctor) => (
            <DoctorCard
              doctor={doctor}
              key={doctor.id}
              onDelete={handleDoctorDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default DoctorsList
