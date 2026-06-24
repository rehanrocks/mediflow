/* eslint-disable react-refresh/only-export-components -- Shares form class helpers with route pages. */
import { AlertCircle, XCircle } from 'lucide-react'

export const FORM_INPUT_CLASS =
  'w-full rounded-control border border-hairline bg-mist/50 px-4 py-2.5 text-[14px] font-normal text-ink outline-none transition-all duration-150 placeholder:text-slate/50 focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/25'

export function getFieldClass(error, extra = '') {
  return [
    FORM_INPUT_CLASS,
    extra,
    error ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-400/25' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function FieldError({ children, tone = 'error' }) {
  if (!children) {
    return null
  }

  const toneClass =
    tone === 'warning' ? 'text-amber-600' : 'text-rose-500'

  return (
    <p
      className={[
        'mt-1.5 flex animate-fade-up items-center gap-1 text-[12px] font-normal',
        toneClass,
      ].join(' ')}
    >
      <AlertCircle aria-hidden="true" className="h-[13px] w-[13px]" />
      {children}
    </p>
  )
}

export function FormField({ children, error, hint, label, optional }) {
  const normalizedError = String(error || '').trim().toLowerCase()
  const normalizedHint = String(hint || '').trim().toLowerCase()
  const showHint = Boolean(hint) && normalizedHint !== normalizedError

  return (
    <label className="block animate-fade-up">
      <span
        className={[
          'mb-1.5 block text-[13px] font-medium',
          error ? 'text-rose-500' : 'text-ink',
        ].join(' ')}
      >
        {label}
        {optional ? (
          <span className="ml-1 text-[12px] font-normal text-slate">
            (optional)
          </span>
        ) : null}
      </span>
      {children}
      {showHint ? (
        <p
          className={[
            'mt-1.5 text-[12px] font-normal italic',
            error ? 'text-rose-500' : 'text-slate/60',
          ].join(' ')}
        >
          {hint}
        </p>
      ) : null}
      <FieldError>{error}</FieldError>
    </label>
  )
}

export function FormSection({ children, title }) {
  return (
    <section className="animate-fade-up">
      <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-slate">
        {title}
      </h2>
      <div className="mb-5 h-px bg-hairline" />
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

export function ErrorBanner({ message }) {
  if (!message) {
    return null
  }

  return (
    <div className="flex animate-fade-up items-start gap-2 rounded-control border border-rose-200 bg-rose-50 px-4 py-3">
      <XCircle
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
      />
      <p className="text-[13px] font-medium text-rose-700">{message}</p>
    </div>
  )
}

export function LoadingSpinner({ light = false }) {
  return (
    <span
      className={[
        'h-4 w-4 rounded-full border-2 animate-spin',
        light ? 'border-white/40 border-t-white' : 'border-brand/20 border-t-brand',
      ].join(' ')}
    />
  )
}
