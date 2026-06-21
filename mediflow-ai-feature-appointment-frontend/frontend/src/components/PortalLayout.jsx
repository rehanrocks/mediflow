/* src/components/PortalLayout.jsx - Composes sidebar, topbar, mobile nav, and route content. */
import { useState } from 'react'
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

export function PortalLayout() {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const meta = PAGE_META[location.pathname] || DEFAULT_META

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
            <Outlet />
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
