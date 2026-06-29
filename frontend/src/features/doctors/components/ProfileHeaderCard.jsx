/* src/features/doctors/components/ProfileHeaderCard.jsx - Doctor profile header. */
import { Calendar } from 'lucide-react'

import Avatar from '@shared/components/Avatar'
import DoctorStatusBadge from '@shared/components/doctors/DoctorStatusBadge'
import SpecializationChip from '@shared/components/doctors/SpecializationChip'
import { formatShiftTime } from '@shared/lib/doctorUtils'
import { formatDate, getDoctorName } from '@shared/lib/records'
import { usePermission } from '@shared/lib/usePermission'

function DetailItem({ children, label }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-normal uppercase tracking-wide text-slate">
        {label}
      </p>
      <div className="mt-1 min-w-0 text-[14px] font-semibold text-ink">
        {children}
      </div>
    </div>
  )
}

export function ProfileHeaderCard({ doctor }) {
  const { canViewFullDoctorProfile } = usePermission()

  if (!doctor) return null

  const canViewFull = canViewFullDoctorProfile(doctor.id)
  const doctorName = getDoctorName(doctor)

  return (
    <section className="rounded-card bg-canvas p-6 shadow-card">
      <div className="flex flex-col gap-6 min-[900px]:flex-row min-[900px]:items-start min-[900px]:justify-between">
        <div className="flex min-w-0 gap-4">
          <Avatar name={doctorName} size="2xl" />
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-bold text-ink">
              {doctorName}
            </h1>
            <p className="mt-0.5 text-[14px] font-medium text-slate">
              {doctor.qualifications?.map((item) => item.name).join(', ') ||
                doctor.qualification ||
                'Qualification not specified'}
            </p>
            {doctor.specializations?.length ? (
              <div className="mt-3">
                <SpecializationChip
                  compact={false}
                  specializations={doctor.specializations}
                />
              </div>
            ) : null}
            {doctor.join_date ? (
              <p className="mt-3 flex items-center gap-1 font-sans text-[12px] text-slate">
                <Calendar aria-hidden="true" className="h-[13px] w-[13px]" />
                Joined {formatDate(doctor.join_date)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:min-w-[440px] lg:grid-cols-3">
          {canViewFull && doctor.email ? (
            <DetailItem label="Email">
              <a
                className="block truncate font-sans text-[13px] text-brand hover:underline"
                href={`mailto:${doctor.email}`}
              >
                {doctor.email}
              </a>
            </DetailItem>
          ) : null}
          {canViewFull && doctor.phone ? (
            <DetailItem label="Phone">
              <span className="font-sans text-[13px]">{doctor.phone}</span>
            </DetailItem>
          ) : null}
          <DetailItem label="Shift">
            <span className="font-sans text-[13px]">
              {formatShiftTime(doctor.shift_start)} - {formatShiftTime(doctor.shift_end)}
            </span>
          </DetailItem>
          <DetailItem label="Status">
            <DoctorStatusBadge large status={doctor.status} />
          </DetailItem>
          {canViewFull ? (
            <DetailItem label="Experience">
              {doctor.experience_years ?? 0} years
            </DetailItem>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default ProfileHeaderCard
