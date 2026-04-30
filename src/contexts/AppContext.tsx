import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export interface Child {
  id: string
  name: string
  birthDate: string
  weight: number
  avatar: string
}

export interface DosageRecord {
  id: string
  childId: string
  medicine: 'acetaminophen' | 'ibuprofen'
  concentration: string
  amountMl: number
  amountMg: number
  timestamp: string
  memo?: string
}

export interface UserProfile {
  name: string
  provider: 'kakao' | 'naver' | 'google'
  email?: string
}

interface AppState {
  currentChild: Child | null
  children: Child[]
  dosageRecords: DosageRecord[]
  alarmEnabled: boolean
  nextDoseTime: string | null
  isLoggedIn: boolean
  userProfile: UserProfile | null
}

interface AppContextType extends AppState {
  setCurrentChild: (child: Child | null) => void
  addChild: (child: Child) => void
  updateChild: (child: Child) => void
  removeChild: (id: string) => void
  addDosageRecord: (record: DosageRecord) => void
  deleteDosageRecord: (id: string) => void
  setAlarmEnabled: (enabled: boolean) => void
  setNextDoseTime: (time: string | null) => void
  login: (profile: UserProfile) => void
  logout: () => void
}

const STORAGE_KEY = 'smartdose_state_v1'

function loadState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {}
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

const defaultState: AppState = {
  currentChild: null,
  children: [],
  dosageRecords: [],
  alarmEnabled: false,
  nextDoseTime: null,
  isLoggedIn: false,
  userProfile: null,
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const saved = loadState()
    return { ...defaultState, ...saved }
  })

  useEffect(() => {
    saveState(state)
  }, [state])

  const setCurrentChild = useCallback((child: Child | null) => {
    setState((prev) => ({ ...prev, currentChild: child }))
  }, [])

  const addChild = useCallback((child: Child) => {
    setState((prev) => {
      const next = { ...prev, children: [...prev.children, child] }
      if (!next.currentChild) next.currentChild = child
      return next
    })
  }, [])

  const updateChild = useCallback((child: Child) => {
    setState((prev) => {
      const children = prev.children.map((c) => (c.id === child.id ? child : c))
      const currentChild = prev.currentChild?.id === child.id ? child : prev.currentChild
      return { ...prev, children, currentChild }
    })
  }, [])

  const removeChild = useCallback((id: string) => {
    setState((prev) => {
      const children = prev.children.filter((c) => c.id !== id)
      const currentChild = prev.currentChild?.id === id ? (children[0] ?? null) : prev.currentChild
      return { ...prev, children, currentChild }
    })
  }, [])

  const addDosageRecord = useCallback((record: DosageRecord) => {
    setState((prev) => ({
      ...prev,
      dosageRecords: [record, ...prev.dosageRecords],
    }))
  }, [])

  const deleteDosageRecord = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      dosageRecords: prev.dosageRecords.filter((r) => r.id !== id),
    }))
  }, [])

  const setAlarmEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, alarmEnabled: enabled }))
  }, [])

  const setNextDoseTime = useCallback((time: string | null) => {
    setState((prev) => ({ ...prev, nextDoseTime: time }))
  }, [])

  const login = useCallback((profile: UserProfile) => {
    setState((prev) => ({ ...prev, isLoggedIn: true, userProfile: profile }))
  }, [])

  const logout = useCallback(() => {
    setState((prev) => ({ ...prev, isLoggedIn: false, userProfile: null }))
  }, [])

  return (
    <AppContext.Provider
      value={{
        ...state,
        setCurrentChild,
        addChild,
        updateChild,
        removeChild,
        addDosageRecord,
        deleteDosageRecord,
        setAlarmEnabled,
        setNextDoseTime,
        login,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
