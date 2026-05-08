export type MedicineType = 'acetaminophen' | 'ibuprofen'

export interface PendingDosageDraft {
  medicine: MedicineType
  productIndex: number
  weight: number
}

export const PENDING_DOSAGE_KEY = 'smartdose_pending_dosage'

const MEDICINES = new Set<MedicineType>(['acetaminophen', 'ibuprofen'])

export function isPendingDosageDraft(value: unknown): value is PendingDosageDraft {
  if (!value || typeof value !== 'object') return false

  const draft = value as Partial<PendingDosageDraft>
  return (
    typeof draft.medicine === 'string' &&
    MEDICINES.has(draft.medicine as MedicineType) &&
    typeof draft.productIndex === 'number' &&
    Number.isInteger(draft.productIndex) &&
    draft.productIndex >= 0 &&
    typeof draft.weight === 'number' &&
    Number.isFinite(draft.weight)
  )
}

export function getPendingDosageDraft(): PendingDosageDraft | null {
  try {
    const raw = localStorage.getItem(PENDING_DOSAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    return isPendingDosageDraft(parsed) ? parsed : null
  } catch {
    // ignore unavailable storage or invalid JSON
  }
  return null
}

export function savePendingDosageDraft(draft: PendingDosageDraft) {
  try {
    localStorage.setItem(PENDING_DOSAGE_KEY, JSON.stringify(draft))
  } catch {
    // ignore unavailable storage
  }
}
