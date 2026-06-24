import { ROLES } from './roles'

export function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'morning'
  }

  if (hour < 17) {
    return 'afternoon'
  }

  return 'evening'
}

export function buildGreeting(user) {
  const time = getGreeting()

  if (!user) {
    return `Good ${time}`
  }

  if (user.role === ROLES.DOCTOR) {
    const doctorName =
      user.last_name || user.full_name || user.first_name || 'Doctor'

    return `Good ${time}, Dr. ${doctorName}`
  }

  const name = user.first_name || user.full_name || user.last_name

  return name ? `Good ${time}, ${name}` : `Good ${time}`
}
