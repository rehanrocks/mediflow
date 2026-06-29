import { AlertTriangle } from 'lucide-react'

import Avatar from '@shared/components/Avatar'
import { getPatientConditions, getPatientName } from '@shared/lib/records'

export function DuplicatePatientModal({
  onCancel,
  onViewProfile,
  patient,
}) {
  if (!patient) {
    return null
  }

  const condition = getPatientConditions(patient)[0]

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-glass-dark px-4 backdrop-blur-xs animate-fade-in">
      <section
        aria-labelledby="duplicate-patient-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-card bg-canvas p-6 shadow-card animate-scale-in"
        role="alertdialog"
      >
        <div className="flex items-center">
          <AlertTriangle aria-hidden="true" className="mr-2 h-5 w-5 text-amber-500" />
          <h2 className="text-[18px] font-bold text-ink" id="duplicate-patient-title">
            Patient Already Exists
          </h2>
        </div>

        <p className="mt-2 text-[14px] font-normal leading-6 text-slate">
          A patient with this name and phone number is already registered in the system.
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-control bg-mist p-3">
          <Avatar name={getPatientName(patient)} size="md" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">
              {getPatientName(patient)}
            </p>
            <p className="font-sans text-[12px] text-slate">{patient.phone || '-'}</p>
            {condition ? (
              <p className="truncate text-[12px] font-normal text-slate">{condition}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            className="primary-button inline-flex h-10 items-center justify-center rounded-control bg-brand px-4 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            onClick={onViewProfile}
            type="button"
          >
            View Patient Profile
          </button>
          <button
            className="mx-auto px-3 py-1.5 text-[13px] font-semibold text-slate transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  )
}

export default DuplicatePatientModal
