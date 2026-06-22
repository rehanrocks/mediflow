/* src/components/PortalLayout.jsx - Composes sidebar, topbar, mobile nav, and route content. */
import { useCallback, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import Drawer from './Drawer'
import RouteTransition from './RouteTransition'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const PAGE_META = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Overview of your clinic workspace.',
  },
  '/appointments': {
    title: 'Appointments',
    subtitle: 'Manage patient visits and booking activity.',
  },
  '/patients': {
    title: 'Patients',
    subtitle: 'Search and manage patient records.',
  },
}

const DEFAULT_META = {
  title: 'MediFlow',
  subtitle: 'Home page reserved for a future release.',
}

function getRouteMeta(pathname) {
  if (PAGE_META[pathname]) {
    return PAGE_META[pathname]
  }

  if (pathname === '/appointments/book') {
    return {
      title: 'Book Appointment',
      subtitle: 'Register a new visit for a patient.',
    }
  }

  if (/^\/appointments\/[^/]+\/edit$/.test(pathname)) {
    return {
      title: 'Edit Appointment',
      subtitle: 'Update visit details.',
    }
  }

  if (/^\/appointments\/[^/]+$/.test(pathname)) {
    return {
      title: 'Appointment Details',
      subtitle: 'Read-only visit record.',
    }
  }

  if (pathname === '/patients/new') {
    return {
      title: 'Register New Patient',
      subtitle: 'Onboard a patient into the system.',
    }
  }

  if (/^\/patients\/[^/]+\/edit$/.test(pathname)) {
    return {
      title: 'Edit Patient',
      subtitle: 'Update patient details.',
    }
  }

  if (/^\/patients\/[^/]+$/.test(pathname)) {
    return {
      title: 'Patient Profile',
      subtitle: 'Patient Profile',
    }
  }

  return DEFAULT_META
}

export function PortalLayout() {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [pageMetaOverride, setPageMetaOverride] = useState(null)
  const clearPageMeta = useCallback(() => setPageMetaOverride(null), [])
  const setPageMeta = useCallback(
    (nextMeta) =>
      setPageMetaOverride({
        meta: nextMeta,
        pathname: location.pathname,
      }),
    [location.pathname],
  )
  const outletContext = useMemo(
    () => ({
      clearPageMeta,
      setPageMeta,
    }),
    [clearPageMeta, setPageMeta],
  )
  const meta =
    pageMetaOverride?.pathname === location.pathname
      ? pageMetaOverride.meta
      : getRouteMeta(location.pathname)

  return (
    <div className="min-h-screen bg-mist text-ink">
      <Sidebar />
      <Topbar
        onMenuClick={() => setMobileNavOpen(true)}
        subtitle={meta.subtitle}
        title={meta.title}
      />
      <div className="min-h-screen pt-16 md:pl-[64px] lg:pl-[240px]">
        <main className="p-4 md:p-6 lg:p-8">
          <RouteTransition>
            <Outlet context={outletContext} />
          </RouteTransition>
        </main>
      </div>

      <Drawer
        bodyClassName="p-0"
        onClose={() => setMobileNavOpen(false)}
        open={mobileNavOpen}
        title="MediFlow"
        widthClass="max-w-[300px]"
      >
        <Sidebar mobile onNavigate={() => setMobileNavOpen(false)} />
      </Drawer>
    </div>
  )
}

export default PortalLayout
