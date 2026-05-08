export type MedicineType = 'acetaminophen' | 'ibuprofen' | 'dexibuprofen'

export interface Product {
  name: string
  concentration: number
  ingredient: string
  concentrationLabel: string
  age: string
  doseGuide: string
  intervalGuide: string
  dailyMaxGuide: string
  imageSrc: string
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
    {
      name: '챔프시럽',
      concentration: 160,
      ingredient: '아세트아미노펜',
      concentrationLabel: '32mg/mL',
      age: '영유아 및 어린이',
      doseGuide: '체중 기준 10~15mg/kg',
      intervalGuide: '4시간 이상 간격',
      dailyMaxGuide: '1일 최대 4회',
      imageSrc: '/products/champ-syrup.png',
    },
    {
      name: '콜대원키즈펜시럽',
      concentration: 160,
      ingredient: '아세트아미노펜',
      concentrationLabel: '32mg/mL',
      age: '영유아 및 어린이',
      doseGuide: '체중 기준 10~15mg/kg',
      intervalGuide: '4시간 이상 간격',
      dailyMaxGuide: '1일 최대 4회',
      imageSrc: '/products/coldaeone-kids-pen-syrup.png',
    },
    {
      name: '어린이타이레놀현탁액',
      concentration: 160,
      ingredient: '아세트아미노펜',
      concentrationLabel: '32mg/mL',
      age: '영유아 및 어린이',
      doseGuide: '체중 기준 10~15mg/kg',
      intervalGuide: '4시간 이상 간격',
      dailyMaxGuide: '1일 최대 4회',
      imageSrc: '/products/children-tylenol-suspension.png',
    },
    {
      name: '세토펜현탁액',
      concentration: 160,
      ingredient: '아세트아미노펜',
      concentrationLabel: '32mg/mL',
      age: '영유아 및 어린이',
      doseGuide: '체중 기준 10~15mg/kg',
      intervalGuide: '4시간 이상 간격',
      dailyMaxGuide: '1일 최대 4회',
      imageSrc: '/products/setopen-suspension.png',
    },
    {
      name: '어린이 타이레놀산 160mg',
      concentration: 160,
      ingredient: '아세트아미노펜',
      concentrationLabel: '160mg/포',
      age: '어린이',
      doseGuide: '체중 기준 10~15mg/kg',
      intervalGuide: '4시간 이상 간격',
      dailyMaxGuide: '1일 최대 4회',
      imageSrc: '/products/children-tylenol-powder-160mg.png',
    },
  ],
  ibuprofen: [
    {
      name: '어린이부루펜시럽',
      concentration: 100,
      ingredient: '이부프로펜',
      concentrationLabel: '20mg/mL',
      age: '어린이',
      doseGuide: '체중 기준 5~10mg/kg',
      intervalGuide: '6~8시간 간격',
      dailyMaxGuide: '1일 최대 4회',
      imageSrc: '/products/children-brufen-syrup.png',
    },
  ],
  dexibuprofen: [
    {
      name: '맥시부펜시럽',
      concentration: 60,
      ingredient: '덱시부프로펜',
      concentrationLabel: '12mg/mL',
      age: '어린이',
      doseGuide: '체중 기준 5~7mg/kg',
      intervalGuide: '4~6시간 간격',
      dailyMaxGuide: '1일 최대 4회',
      imageSrc: '/products/maxibupen-syrup.png',
    },
    {
      name: '이지엔6키즈시럽',
      concentration: 60,
      ingredient: '덱시부프로펜',
      concentrationLabel: '12mg/mL',
      age: '어린이',
      doseGuide: '체중 기준 5~7mg/kg',
      intervalGuide: '4~6시간 간격',
      dailyMaxGuide: '1일 최대 4회',
      imageSrc: '/products/easyen6-kids-syrup.png',
    },
    {
      name: '보령펜시럽',
      concentration: 60,
      ingredient: '덱시부프로펜',
      concentrationLabel: '12mg/mL',
      age: '어린이',
      doseGuide: '체중 기준 5~7mg/kg',
      intervalGuide: '4~6시간 간격',
      dailyMaxGuide: '1일 최대 4회',
      imageSrc: '/products/boryung-pen-syrup.png',
    },
    {
      name: '애니펜시럽',
      concentration: 60,
      ingredient: '덱시부프로펜',
      concentrationLabel: '12mg/mL',
      age: '어린이',
      doseGuide: '체중 기준 5~7mg/kg',
      intervalGuide: '4~6시간 간격',
      dailyMaxGuide: '1일 최대 4회',
      imageSrc: '/products/anypen-syrup.png',
    },
  ],
}

export const MEDICINE_NAMES: Record<MedicineType, string> = {
  acetaminophen: '아세트아미노펜',
  ibuprofen: '이부프로펜',
  dexibuprofen: '덱시부프로펜',
}

export const MEDICINE_INTERVAL_HOURS: Record<MedicineType, number> = {
  acetaminophen: 4,
  ibuprofen: 6,
  dexibuprofen: 4,
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
      const defaultMedicine =
        parsed.defaultMedicine === 'ibuprofen' || parsed.defaultMedicine === 'dexibuprofen'
          ? parsed.defaultMedicine
          : 'acetaminophen'
      return {
        defaultMedicine,
        defaultConcentration: parsed.defaultConcentration || `${PRODUCTS[defaultMedicine][0].concentration}mg/5ml`,
      }
    }
  } catch {
    // ignore
  }
  return { defaultMedicine: 'acetaminophen', defaultConcentration: '160mg/5ml' }
}

export function getProductIndexForPreference(medicine: MedicineType, concentration: string): number {
  const concentrationValue = Number.parseInt(concentration, 10)
  const index = PRODUCTS[medicine].findIndex((product) => product.concentration === concentrationValue)
  return index >= 0 ? index : 0
}
