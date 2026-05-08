export const STORAGE_PREFS_KEY = 'smartdose_prefs_v1'

export type MedicineType = 'acetaminophen' | 'ibuprofen'

export interface Prefs {
  defaultMedicine: MedicineType
  defaultConcentration: string
}

export const DEFAULT_PREFS: Prefs = {
  defaultMedicine: 'acetaminophen',
  defaultConcentration: '100mg/5ml',
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>
      return {
        defaultMedicine: parsed.defaultMedicine === 'ibuprofen' ? 'ibuprofen' : DEFAULT_PREFS.defaultMedicine,
        defaultConcentration:
          typeof parsed.defaultConcentration === 'string'
            ? parsed.defaultConcentration
            : DEFAULT_PREFS.defaultConcentration,
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_PREFS
}

export function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

export function parseConcentration(defaultConcentration: string): number | null {
  const match = defaultConcentration.trim().match(/^(\d+(?:\.\d+)?)\s*mg\s*\/\s*5\s*ml$/i)
  if (!match) return null

  const concentration = Number(match[1])
  return Number.isFinite(concentration) ? concentration : null
}

export function getProductIndexForPreference<T extends { concentration: number }>(
  products: T[],
  defaultConcentration: string,
): number {
  const concentration = parseConcentration(defaultConcentration)
  if (concentration == null) return 0

  const index = products.findIndex((product) => product.concentration === concentration)
  return index >= 0 ? index : 0
}
