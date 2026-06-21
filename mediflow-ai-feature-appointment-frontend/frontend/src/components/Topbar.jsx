/* src/components/Topbar.jsx - Renders frosted page chrome with search and profile menu. */
import { useState } from 'react'
import { Bell, LogOut, Menu, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'

export function Topbar({ onMenuClick, subtitle, title }) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    'MediFlow User'

  function handleLogout() {
    logout()
    setMenuOpen(false)
    navigate('/login', { replace: true })
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-hairline bg-mist/80 px-4 backdrop-blur-md md:left-[64px] md:px-6 lg:left-[240px] lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-control text-slate transition hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 md:hidden"
          onClick={onMenuClick}
          type="button"
        >
          <span className="sr-only">Open navigation</span>
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-bold leading-7 text-ink">
            {title}
          </h1>
          <p className="mt-0.5 truncate text-[13px] font-medium text-slate">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="ml-4 flex shrink-0 items-center gap-3">
        <label className="relative hidden sm:block">
          <span className="sr-only">Search</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate"
          />
          <input
            className="h-[38px] w-[220px] rounded-control border border-hairline bg-canvas pl-9 pr-4 text-[14px] font-normal text-ink outline-none transition-all duration-300 placeholder:text-slate/60 focus:w-[280px] focus:border-brand focus:ring-2 focus:ring-brand/30"
            placeholder="Search"
            type="search"
          />
        </label>

        <button
          aria-label="Notifications"
          className="relative hidden h-10 w-10 items-center justify-center rounded-control text-slate transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 sm:inline-flex"
          type="button"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <span className="sr-only">Open user menu</span>
            <Avatar name={fullName} online size="lg" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full mt-2 min-w-[190px] overflow-hidden rounded-xl border border-hairline bg-canvas py-1 shadow-card animate-scale-in">
              <div className="border-b border-hairline px-3 py-2">
                <p className="truncate text-sm font-semibold text-ink">{fullName}</p>
                <p className="truncate text-xs font-medium capitalize text-slate">
                  {user?.role || 'member'}
                </p>
              </div>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate transition hover:bg-mist hover:text-status-cancelled-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                onClick={handleLogout}
                type="button"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default Topbar
