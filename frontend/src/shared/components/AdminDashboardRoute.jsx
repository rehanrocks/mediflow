import { Navigate } from 'react-router-dom'

import { useAuth } from '@shared/context/AuthContext'
import { isDoctor } from '@shared/lib/permissions'

export function AdminDashboardRoute({ children }) {
  const { user } = useAuth()

  if (isDoctor(user)) {
    return <Navigate replace to="/dashboard/doctor" />
  }

  return children
}

export default AdminDashboardRoute
