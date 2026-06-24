export function computeAge(dobString) {
  if (!dobString) {
    return null
  }

  const dob = new Date(dobString)

  if (Number.isNaN(dob.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()

  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }

  return age
}
