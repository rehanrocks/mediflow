import Avatar from '@shared/components/Avatar'
import { Link } from 'react-router-dom'
import {
  formatDate,
  getPatientAge,
  getPatientConditions,
  getPatientMedications,
  getPatientName,
} from '@shared/lib/records'

function CompactChip({ children }) {
  return (
    <span className="rounded-full border border-brand/20 bg-canvas px-2 py-0.5 text-[11px] font-medium text-brand">
      {children}
    </span>
  )
}

export function PatientSummaryPanel({ link, patient }) {
  if (!patient) {
    return null
  }

  const age = getPatientAge(patient)
  const conditions = getPatientConditions(patient)
  const medications = getPatientMedications(patient)

  return (
    <section className="mt-3 rounded-xl border border-brand/20 bg-brand-light/40 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={getPatientName(patient)} size="md" />
          <div className="min-w-0">
            {link ? (
              <Link
                className="truncate text-[15px] font-semibold text-ink transition hover:text-brand"
                to={link}
              >
                {getPatientName(patient)}
              </Link>
            ) : (
              <p className="truncate text-[15px] font-semibold text-ink">
                {getPatientName(patient)}
              </p>
            )}
            <p className="mt-1 font-sans text-[12px] font-medium text-slate">
              {Number.isFinite(age) ? `${age} yrs` : '-'} · {patient.phone || '-'}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-sans text-[12px] font-medium text-slate">
            Last Visit: {formatDate(patient.last_visit_date)}
          </p>
          <p className="mt-1 text-[12px] font-medium text-slate">
            {medications.length > 0
              ? `Active meds: ${medications.slice(0, 2).join(', ')}`
              : 'No active medications'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {conditions.length > 0 ? (
          conditions.slice(0, 4).map((condition) => (
            <CompactChip key={condition}>{condition}</CompactChip>
          ))
        ) : (
          <span className="text-[12px] italic text-slate/60">
            No conditions recorded
          </span>
        )}
      </div>
    </section>
  )
}

export default PatientSummaryPanel
