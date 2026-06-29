/* src/shared/lib/navItems.js - Computes permission-aware sidebar navigation. */
import {
  BarChart2,
  Briefcase,
  CalendarClock,
  LayoutDashboard,
  ShieldCheck,
  Stethoscope,
  UserCircle,
  Users,
} from 'lucide-react'

export function getNavItems({ canRead, isAdmin, role, user }) {
  if (!role) {
    return []
  }

  const isDoctor = role.slug === 'doctor'
  const dashboardPath = isDoctor ? '/dashboard/doctor' : '/dashboard/general'
  const dashboardLabel = isDoctor ? 'My Dashboard' : 'Dashboard'
  const doctorId = user?.id ?? user?.doctor_id
  const doctorProfilePath = doctorId ? `/doctors/${doctorId}` : null

  const items = [
    {
      end: true,
      icon: LayoutDashboard,
      label: dashboardLabel,
      matchPaths: ['/dashboard/general', '/dashboard/admin', '/dashboard/doctor'],
      to: dashboardPath,
    },
  ]

  if (canRead('appointments')) {
    items.push({
      icon: CalendarClock,
      label: isDoctor ? 'My Appointments' : 'Appointments',
      to: '/appointments',
    })
  }

  if (canRead('patients')) {
    items.push({
      icon: Users,
      label: isDoctor ? 'My Patients' : 'Patients',
      to: '/patients',
    })
  }

  if (canRead('doctors')) {
    items.push({ icon: Stethoscope, label: 'Doctors', to: '/doctors' })
  } else if (isDoctor && doctorProfilePath) {
    items.push({
      icon: UserCircle,
      label: 'My Profile',
      to: doctorProfilePath,
    })
  }

  if (canRead('staff')) {
    items.push({ icon: Briefcase, label: 'Staff', to: '/staff' })
  }

  if (canRead('reports')) {
    items.push({ icon: BarChart2, label: 'Reports', to: '/reports' })
  }

  if (isAdmin) {
    items.push({
      icon: ShieldCheck,
      label: 'Access Control',
      to: '/access-control',
    })
  }

  return items
}
