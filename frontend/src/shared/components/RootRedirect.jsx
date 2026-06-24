/* src/shared/components/RootRedirect.jsx - Sends authenticated users to the correct role home. */
import { Navigate } from 'react-router-dom'

import { useAuth } from '@shared/context/AuthContext'

export function RootRedirect() {
  const { homePath } = useAuth()

  return <Navigate to={homePath()} replace />
}

export default RootRedirect
