/* src/shared/components/PortalLayout.jsx - Composes sidebar, topbar, mobile nav, and route content. */
import { useCallback, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@shared/context/AuthContext'
import { buildGreeting } from '@shared/lib/greeting'
import { isDoctor } from '@shared/lib/permissions'
import Drawer from './Drawer'
import RouteTransition from './RouteTransition'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const PAGE_META = {
  '/appointments': {
    title: 'Appointments',
  },
  '/patients': {
    title: 'Patients',
  },
  '/doctors': {
    title: 'Doctors',
    subtitle: 'Clinical team overview and availability',
  },
  '/staff': {
    title: 'Staff',
    subtitle: 'Manage clinic staff and their roles',
  },
}

const DEFAULT_META = {
  title: 'MediFlow',
  subtitle: 'Home page reserved for a future release.',
}

function getRouteMeta(pathname, user) {
  if (pathname === '/dashboard/admin') {
    return {
      title: 'Dashboard',
      subtitle: buildGreeting(user),
    }
  }

  if (pathname === '/dashboard/doctor') {
    if (isDoctor(user)) {
      return {
        title: 'My Dashboard',
        subtitle: buildGreeting(user),
      }
    }

    return {
      title: 'Doctor Dashboard',
      subtitle: 'Support preview of the doctor workspace.',
    }
  }

  if (PAGE_META[pathname]) {
    if (pathname === '/appointments') {
      return {
        ...PAGE_META[pathname],
        subtitle: isDoctor(user)
          ? 'Your scheduled appointments'
          : 'All clinic appointments',
      }
    }

    if (pathname === '/patients') {
      return {
        ...PAGE_META[pathname],
        subtitle: isDoctor(user)
          ? 'Your assigned patients'
          : 'All clinic patients',
      }
    }

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

  if (pathname === '/doctors/new') {
    return {
      title: 'Add Doctor',
      subtitle: 'Create a clinical team profile.',
    }
  }

  if (/^\/doctors\/[^/]+\/edit$/.test(pathname)) {
    return {
      title: 'Edit Doctor',
      subtitle: 'Update clinical team details.',
    }
  }

  if (/^\/doctors\/[^/]+$/.test(pathname)) {
    return {
      title: 'Doctor Profile',
      subtitle: 'Clinical profile and performance data.',
    }
  }

  if (pathname === '/staff/new') {
    return {
      title: 'Add Staff',
      subtitle: 'Create an operational team profile.',
    }
  }

  if (/^\/staff\/[^/]+\/edit$/.test(pathname)) {
    return {
      title: 'Edit Staff',
      subtitle: 'Update operational team details.',
    }
  }

  if (/^\/staff\/[^/]+$/.test(pathname)) {
    return {
      title: 'Staff Profile',
      subtitle: 'Operational profile and employment details.',
    }
  }

  return DEFAULT_META
}

export function PortalLayout() {
  const { user } = useAuth()
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
      : getRouteMeta(location.pathname, user)

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
