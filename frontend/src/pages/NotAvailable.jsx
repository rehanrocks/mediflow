/* src/pages/NotAvailable.jsx - Shows a calm state for disabled feature routes. */
import { Home, Mail } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export function NotAvailable() {
  const location = useLocation()
  const featureKey = location.state?.featureKey

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist p-6 text-ink">
      <section className="animate-fade-up flex max-w-[520px] flex-col items-center text-center">
        <svg
          aria-hidden="true"
          className="h-[120px] w-[120px] animate-float"
          fill="none"
          viewBox="0 0 120 120"
        >
          <rect fill="#EEF2FF" height="94" rx="28" width="94" x="13" y="13" />
          <path
            d="M60 27L85 38V58C85 75 74.4 88.6 60 93C45.6 88.6 35 75 35 58V38L60 27Z"
            fill="#818CF8"
            opacity="0.35"
          />
          <path
            d="M60 32L79 40.4V57.8C79 71.2 71.3 81.8 60 86C48.7 81.8 41 71.2 41 57.8V40.4L60 32Z"
            fill="#4338CA"
          />
          <rect fill="#FFFFFF" height="22" rx="5" width="30" x="45" y="55" />
          <path
            d="M52 55V49C52 44.6 55.6 41 60 41C64.4 41 68 44.6 68 49V55"
            stroke="#FFFFFF"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <circle cx="60" cy="66" fill="#4338CA" r="3" />
        </svg>

        <h1 className="mt-8 text-center text-[24px] font-bold text-ink">
          Not available on your plan
        </h1>
        <p className="mt-3 max-w-sm text-center text-[15px] font-normal leading-relaxed text-slate">
          This feature is not enabled for your organization. Contact your
          administrator to activate it.
        </p>

        {featureKey ? (
          <p className="mt-5 rounded-control bg-brand-light px-3 py-1.5 font-mono text-[12px] font-medium text-brand">
            {featureKey}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            className="primary-button inline-flex h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            to="/dashboard"
          >
            <Home aria-hidden="true" className="mr-1.5 h-[15px] w-[15px]" />
            Go to Dashboard
          </Link>
          <a
            className="inline-flex h-10 items-center justify-center rounded-control border border-hairline bg-canvas px-4 text-sm font-semibold text-slate transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            href="mailto:admin@mediflow.local"
          >
            <Mail aria-hidden="true" className="mr-1.5 h-[15px] w-[15px]" />
            Contact Admin
          </a>
        </div>
      </section>
    </main>
  )
}

export default NotAvailable
