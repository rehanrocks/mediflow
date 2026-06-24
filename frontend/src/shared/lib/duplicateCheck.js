import { normalizeList } from '@shared/lib/records'

export async function checkDuplicatePatient(fullName, phone, getPatients) {
  const normalizedName = String(fullName || '').trim().toLowerCase()
  const normalizedPhone = String(phone || '').trim()

  if (!normalizedName || !normalizedPhone) {
    return null
  }

  try {
    const response = await getPatients({ search: normalizedPhone })
    const patients = normalizeList(response)

    return (
      patients.find(
        (patient) =>
          patient.phone === normalizedPhone &&
          String(patient.full_name || '')
            .trim()
            .toLowerCase() === normalizedName,
      ) || null
    )
  } catch {
    return null
  }
}
