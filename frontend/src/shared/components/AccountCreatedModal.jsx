import { CheckCircle2, Mail } from 'lucide-react'

export function AccountCreatedModal({
  email,
  entityLabel,
  fullName,
  onViewProfile,
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-glass-dark px-4 backdrop-blur-xs animate-fade-in">
      <section
        aria-labelledby="account-created-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-card bg-canvas p-6 shadow-card animate-scale-in"
        role="dialog"
      >
        <div className="flex items-center">
          <CheckCircle2
            aria-hidden="true"
            className="mr-2 h-[22px] w-[22px] text-green-500"
          />
          <h2
            className="text-[18px] font-bold text-ink"
            id="account-created-title"
          >
            Account Created Successfully
          </h2>
        </div>

        <p className="mt-3 text-[14px] font-normal leading-relaxed text-slate">
          {fullName || entityLabel}'s profile has been created and login
          credentials have been sent to:
        </p>

        <div className="mt-3 flex items-center gap-2 rounded-control bg-mist px-4 py-2.5">
          <Mail aria-hidden="true" className="h-[14px] w-[14px] text-slate" />
          <span className="font-sans text-[14px] text-ink">{email}</span>
        </div>

        <p className="mt-3 text-[13px] font-normal text-slate">
          They will receive an email with their temporary password and
          instructions to access the portal.
        </p>

        <button
          className="primary-button mt-5 w-full rounded-control bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
          onClick={onViewProfile}
          type="button"
        >
          View Profile
        </button>
      </section>
    </div>
  )
}

export default AccountCreatedModal
