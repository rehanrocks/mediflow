/* src/shared/lib/navItems.js - Computes role-aware sidebar navigation. */
import {
  BadgeCheck,
  CalendarClock,
  LayoutDashboard,
  Stethoscope,
  Users,
} from 'lucide-react'

import { ROLES } from './roles'

export function getNavItems(user, hasFeature) {
  if (!user) {
    return []
  }

  const dashboardPath =
    user.role === ROLES.DOCTOR
      ? '/dashboard/doctor'
      : '/dashboard/admin'
  const dashboardLabel =
    user.role === ROLES.DOCTOR ? 'My Dashboard' : 'Dashboard'

  const items = [
    {
      to: dashboardPath,
      label: dashboardLabel,
      icon: LayoutDashboard,
      end: true,
      matchPaths: ['/dashboard/admin', '/dashboard/doctor'],
    },
  ]

  if (hasFeature('appointments')) {
    items.push({
      to: '/appointments',
      label:
        user.role === ROLES.DOCTOR
          ? 'My Appointments'
          : 'Appointments',
      icon: CalendarClock,
    })
  }

  if (hasFeature('patients')) {
    items.push({
      to: '/patients',
      label: user.role === ROLES.DOCTOR ? 'My Patients' : 'Patients',
      icon: Users,
    })
  }

  if (hasFeature('doctors') && user.role !== ROLES.DOCTOR) {
    items.push({
      to: '/doctors',
      label: 'Doctors',
      icon: Stethoscope,
    })
  }

  if (hasFeature('staff') && user.role === ROLES.ADMIN) {
    items.push({
      to: '/staff',
      label: 'Staff',
      icon: BadgeCheck,
    })
  }

  return items
}
