/* src/components/RouteTransition.jsx - Applies keyed page entrance transitions per route. */
import { useLocation } from 'react-router-dom'

export function RouteTransition({ children }) {
  const location = useLocation()

  return (
    <div className="animate-route-in" key={location.pathname}>
      {children}
    </div>
  )
}

export default RouteTransition
