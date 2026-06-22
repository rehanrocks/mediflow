import { AlertTriangle } from 'lucide-react'

import { LoadingSpinner } from './FormPrimitives'

export function ConfirmationModal({
  body,
  confirmLabel = 'Delete',
  isLoading = false,
  onCancel,
  onConfirm,
  title,
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-glass-dark px-4 backdrop-blur-xs animate-fade-in">
      <section
        aria-describedby="confirmation-description"
        aria-labelledby="confirmation-title"
        aria-modal="true"
        className="w-full max-w-[420px] rounded-card border border-hairline bg-canvas p-6 shadow-[0_16px_60px_rgba(20,24,31,0.18)] animate-scale-in"
        role="alertdialog"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-status-cancelled-bg text-status-cancelled-text">
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold text-ink" id="confirmation-title">
              {title}
            </h2>
            <p
              className="mt-2 text-[14px] font-normal leading-6 text-slate"
              id="confirmation-description"
            >
              {body}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-control bg-mist px-4 py-2.5 text-[14px] font-semibold text-slate transition hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex min-w-[120px] items-center justify-center rounded-control bg-status-cancelled-text px-4 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-cancelled-text/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading ? <LoadingSpinner light /> : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export default ConfirmationModal
