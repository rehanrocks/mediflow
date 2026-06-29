/* src/shared/components/Sidebar.jsx - Renders the blue portal navigation. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@shared/context/AuthContext'
import { usePermission } from '@shared/lib/usePermission'
import { stagger } from '@shared/lib/motion'
import { getNavItems } from '@shared/lib/navItems'
import Avatar from './Avatar'

function LogoMark() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 18V6L9.8 12L12 9.7L14.2 12L20 6V18H16.8V13.7L12 18.3L7.2 13.7V18H4Z"
        fill="currentColor"
      />
    </svg>
  )
}

function matchesItemPath(item, pathname) {
  const candidatePaths = Array.isArray(item.matchPaths) && item.matchPaths.length > 0
    ? item.matchPaths
    : [item.to]

  return candidatePaths.some((candidatePath) =>
    item.end ? pathname === candidatePath : pathname.startsWith(candidatePath),
  )
}

export function Sidebar({ mobile = false, onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, role, user } = useAuth()
  const permissions = usePermission()
  const itemRefs = useRef({})
  const [activeStyle, setActiveStyle] = useState({ opacity: 0, transform: '' })
  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    'MediFlow User'
  const roleLabel = role?.name || 'User'
  const visibleNavItems = useMemo(
    () => getNavItems({ ...permissions, user }),
    [permissions, user],
  )

  useEffect(() => {
    const activeItem = visibleNavItems.find((item) =>
      matchesItemPath(item, location.pathname),
    )
    const activeElement = activeItem ? itemRefs.current[activeItem.to] : null

    if (!activeElement) {
      setActiveStyle((currentStyle) =>
        currentStyle.opacity === 0 && currentStyle.transform === ''
          ? currentStyle
          : { opacity: 0, transform: '' },
      )
      return
    }

    const nextStyle = {
      height: `${activeElement.offsetHeight}px`,
      opacity: 1,
      transform: `translateY(${activeElement.offsetTop}px)`,
    }

    setActiveStyle((currentStyle) =>
      currentStyle.height === nextStyle.height &&
      currentStyle.opacity === nextStyle.opacity &&
      currentStyle.transform === nextStyle.transform
        ? currentStyle
        : nextStyle,
    )
  }, [location.pathname, visibleNavItems])

  function handleLogout() {
    logout()
    onNavigate?.()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={[
        'flex flex-col border-r border-hairline bg-brand-light text-ink shadow-[inset_-1px_0_0_rgba(20,24,31,0.05)]',
        mobile
          ? 'h-full w-full'
          : 'fixed left-0 top-0 z-30 hidden h-screen w-[64px] animate-slide-right md:flex lg:w-[240px]',
      ].join(' ')}
    >
      <div className="flex h-[72px] items-center gap-3 px-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
          <LogoMark />
        </div>
        <div className={mobile ? 'min-w-0' : 'hidden min-w-0 lg:block'}>
          <p className="truncate text-[18px] font-bold leading-6 text-ink">
            MediFlow
          </p>
          <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-slate">
            {user?.organization_name || 'Clinic workspace'}
          </p>
        </div>
      </div>

      <div className="mx-4 h-px bg-brand/10" />

      <nav className="relative flex-1 overflow-y-auto px-3 py-3">
        <div
          aria-hidden="true"
          className="absolute left-3 right-3 rounded-xl bg-canvas shadow-card transition-all duration-200"
          style={activeStyle}
        />
        <div className="relative space-y-1">
          {visibleNavItems.map((item, index) => {
            const Icon = item.icon
            const itemActive = matchesItemPath(item, location.pathname)

            return (
              <NavLink
                className={() =>
                  [
                    'flex h-[42px] items-center gap-3 rounded-xl px-3 text-[14px] transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-light',
                    itemActive
                      ? 'font-semibold text-ink'
                      : 'font-semibold text-slate hover:bg-canvas/70 hover:text-ink',
                  ].join(' ')
                }
                end={item.end}
                key={item.to}
                onClick={onNavigate}
                ref={(element) => {
                  itemRefs.current[item.to] = element
                }}
                style={stagger(index, 0.04)}
                title={item.label}
                to={item.to}
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                <span className={mobile ? 'truncate' : 'hidden truncate lg:block'}>
                  {item.label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      <div className="px-3 pb-4">
        <div className="mb-3 h-px bg-brand/10" />
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar name={fullName} online size="sm" />
          <div className={mobile ? 'min-w-0' : 'hidden min-w-0 lg:block'}>
            <p className="truncate text-[13px] font-semibold text-ink">
              {fullName}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium tracking-[0.08em] text-slate">
              {roleLabel}
            </p>
          </div>
        </div>
        <button
          className="mt-2 flex h-[38px] w-full items-center justify-center gap-2 rounded-xl bg-transparent text-[13px] font-semibold text-slate transition-all duration-150 hover:bg-canvas/70 hover:text-status-cancelled-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-light lg:justify-start lg:px-3"
          onClick={handleLogout}
          title="Sign Out"
          type="button"
        >
          <LogOut aria-hidden="true" className="h-[15px] w-[15px]" />
          <span className={mobile ? 'inline' : 'hidden lg:inline'}>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
