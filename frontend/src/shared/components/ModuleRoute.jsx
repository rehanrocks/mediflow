import { Navigate } from 'react-router-dom'

import { usePermission } from '@shared/lib/usePermission'

export function ModuleRoute({ action, children, module }) {
  const { can } = usePermission()

  if (!can(module, action)) {
    return <Navigate replace to="/not-available" />
  }

  return children
}

export default ModuleRoute
