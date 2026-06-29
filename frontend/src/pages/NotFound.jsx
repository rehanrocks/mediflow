/* src/pages/NotFound.jsx - Shows a friendly 404 for invalid frontend routes. */
import { ArrowLeft, SearchX } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export function NotFound() {
  const location = useLocation()

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist p-6 text-ink">
      <section className="animate-fade-up flex max-w-[520px] flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-card bg-brand-light text-brand shadow-card">
          <SearchX aria-hidden="true" className="h-11 w-11" />
        </div>

        <p className="mt-7 font-sans text-[13px] font-semibold text-brand">
          404
        </p>
        <h1 className="mt-2 text-center text-[28px] font-bold text-ink">
          Page not found
        </h1>
        <p className="mt-3 max-w-sm text-center text-[15px] font-normal leading-relaxed text-slate">
          The route you tried to open does not exist in MediFlow.
        </p>

        <p className="mt-5 max-w-full rounded-control bg-canvas px-3 py-1.5 font-sans text-[12px] font-medium text-slate shadow-card">
          {location.pathname}
        </p>

        <Link
          className="primary-button mt-8 inline-flex h-10 items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
          to="/login"
        >
          <ArrowLeft aria-hidden="true" className="mr-1.5 h-[15px] w-[15px]" />
          Return to Login
        </Link>
      </section>
    </main>
  )
}

export default NotFound
