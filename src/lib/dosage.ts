export type MedicineType = 'acetaminophen' | 'ibuprofen'

export interface Product {
  name: string
  concentration: number
}

export interface PendingDosageDraft {
  medicine: MedicineType
  productIndex: number
  weight: number
}

export interface DoseAlarmData {
  time: string
  childName: string
  medicine: MedicineType
  enabled: boolean
}

export interface DosagePrefs {
  defaultMedicine: MedicineType
  defaultConcentration: string
}

export const PRODUCTS: Record<MedicineType, Product[]> = {
  acetaminophen: [
    { name: '타세놀 시럽', concentration: 100 },
    { name: '페디아 시럽', concentration: 120 },
    { name: '타이레놀 시럽', concentration: 160 },
  ],
  ibuprofen: [
    { name: '브루펜 시럽', concentration: 100 },
    { name: '아이프로엔 시럽', concentration: 100 },
  ],
}

export const MEDICINE_NAMES: Record<MedicineType, string> = {
  acetaminophen: '아세트아미노펜',
  ibuprofen: '이부프로펜',
}

export const MEDICINE_INTERVAL_HOURS: Record<MedicineType, number> = {
  acetaminophen: 4,
  ibuprofen: 6,
}

export const PENDING_KEY = 'smartdose_pending_dosage'
export const SETTINGS_PREFS_KEY = 'smartdose_prefs_v1'

export function getPendingDosage(): PendingDosageDraft | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return null
}

export function savePendingDosageDraft(dosage: PendingDosageDraft) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(dosage))
  } catch {
    // ignore
  }
}

export function loadDosagePrefs(): DosagePrefs {
  try {
    const raw = localStorage.getItem(SETTINGS_PREFS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DosagePrefs>
      const defaultMedicine = parsed.defaultMedicine === 'ibuprofen' ? 'ibuprofen' : 'acetaminophen'
      return {
        defaultMedicine,
        defaultConcentration: parsed.defaultConcentration || `${PRODUCTS[defaultMedicine][0].concentration}mg/5ml`,
      }
    }
  } catch {
    // ignore
  }
  return { defaultMedicine: 'acetaminophen', defaultConcentration: '100mg/5ml' }
}

export function getProductIndexForPreference(medicine: MedicineType, concentration: string): number {
  const concentrationValue = Number.parseInt(concentration, 10)
  const index = PRODUCTS[medicine].findIndex((product) => product.concentration === concentrationValue)
  return index >= 0 ? index : 0
}
