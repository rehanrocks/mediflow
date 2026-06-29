/* src/shared/components/Topbar.jsx - Renders frosted page chrome with search and profile menu. */
import { useState } from 'react'
import { Bell, LogOut, Menu } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@shared/context/AuthContext'
import Avatar from './Avatar'

export function Topbar({ onMenuClick, subtitle, title }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, role, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    'MediFlow User'
  const roleLabel = role?.name || 'User'

  function handleNotificationsToggle() {
    setMenuOpen(false)
    setNotificationsOpen((open) => !open)
  }

  function handleLogout() {
    logout()
    setMenuOpen(false)
    setNotificationsOpen(false)
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
          <h1 className="truncate font-sans text-[24px] font-normal leading-7 text-ink">
            {title}
          </h1>
          <p className="mt-0.5 truncate text-[13px] font-medium text-slate">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="ml-4 flex shrink-0 items-center gap-3">
        <div className="relative hidden sm:block">
          <button
            aria-expanded={notificationsOpen}
            aria-label="Notifications"
            className="relative h-10 w-10 items-center justify-center rounded-control text-slate transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 sm:inline-flex"
            onClick={handleNotificationsToggle}
            type="button"
          >
            <Bell aria-hidden="true" className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-status-cancelled-text" />
          </button>

          {notificationsOpen ? (
            <div className="absolute right-0 top-full mt-2 w-[260px] overflow-hidden rounded-xl border border-hairline bg-canvas shadow-card animate-scale-in">
              <div className="border-b border-hairline px-4 py-3">
                <p className="text-sm font-semibold text-ink">Notifications</p>
                <p className="mt-0.5 text-xs font-medium text-slate">
                  Frontend demo alerts
                </p>
              </div>
              <div className="px-4 py-4">
                <p className="text-sm font-medium text-ink">No new alerts</p>
                <p className="mt-1 text-xs font-normal leading-5 text-slate">
                  Appointment and patient updates will appear here later.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            onClick={() => {
              setNotificationsOpen(false)
              setMenuOpen((open) => !open)
            }}
            type="button"
          >
            <span className="sr-only">Open user menu</span>
            <Avatar name={fullName} online size="lg" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full mt-2 min-w-[190px] overflow-hidden rounded-xl border border-hairline bg-canvas py-1 shadow-card animate-scale-in">
              <div className="border-b border-hairline px-3 py-2">
                <p className="truncate text-sm font-semibold text-ink">{fullName}</p>
                <p className="truncate text-xs font-medium text-slate">
                  {roleLabel}
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
