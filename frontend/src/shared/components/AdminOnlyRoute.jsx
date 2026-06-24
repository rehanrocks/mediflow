import { Navigate } from 'react-router-dom'

import { usePermission } from '@shared/lib/usePermission'

export function AdminOnlyRoute({ children }) {
  const { isAdmin } = usePermission()

  if (!isAdmin) {
    return <Navigate replace to="/not-available" />
  }

  return children
}

export default AdminOnlyRoute
