import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export interface Child {
  id: string
  name: string
  birthDate: string
  weight: number
  avatar: string
  gender?: 'male' | 'female'
}

export interface DosageRecord {
  id: string
  childId: string
  medicine: 'acetaminophen' | 'ibuprofen' | 'dexibuprofen'
  concentration: string
  amountMl: number
  amountMg: number
  timestamp: string
  memo?: string
  nextDoseTime?: string
}

export type AuthProvider = 'kakao' | 'naver' | 'google'

export interface UserProfile {
  /** OAuth provider that authenticated this user. */
  provider: AuthProvider
  /** Stable user identifier issued by the OAuth provider. */
  providerUserId: string
  /** Display name returned by the provider or account backend. */
  name: string
  email?: string
  avatarUrl?: string
  /** True only when the app intentionally persists an OAuth access token locally. */
  accessTokenStored: boolean
  /** Optional persisted token. Disabled by default; enable only with VITE_STORE_OAUTH_ACCESS_TOKEN=true. */
  accessToken?: string
  /** ISO-8601 timestamp for access token expiry, when the provider/backend supplies it. */
  tokenExpiresAt?: string
  /** ISO-8601 timestamp for when this session was authenticated. */
  authenticatedAt: string
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
  updateDosageRecord: (record: DosageRecord) => void
  deleteDosageRecord: (id: string) => void
  setAlarmEnabled: (enabled: boolean) => void
  setNextDoseTime: (time: string | null) => void
  login: (profile: UserProfile) => void
  logout: () => void
  resetAppState: () => void
}

const STORAGE_KEY = 'smartdose_state_v1'
const SMARTDOSE_STORAGE_PREFIX = 'smartdose_'
const STORAGE_KEYS_TO_RESET = new Set([
  STORAGE_KEY,
  'smartdose_prefs_v1',
  'smartdose_pending_dosage',
  'smartdose_alarm_v1',
  'smartdose_manual_time_v1',
])

function loadState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {}
}

function isDefaultState(state: AppState) {
  return (
    state.currentChild === null &&
    state.children.length === 0 &&
    state.dosageRecords.length === 0 &&
    state.alarmEnabled === false &&
    state.nextDoseTime === null &&
    state.isLoggedIn === false &&
    state.userProfile === null
  )
}

function saveState(state: AppState) {
  try {
    if (isDefaultState(state)) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

function clearSmartdoseStorage() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i)
      if (!key) continue
      if (STORAGE_KEYS_TO_RESET.has(key) || key.startsWith(SMARTDOSE_STORAGE_PREFIX)) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // ignore
  }
}

function cancelSmartdoseNotifications() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.ready
    .then((registration) => {
      if (!('getNotifications' in registration)) return undefined
      return registration.getNotifications().then((notifications) => {
        notifications.forEach((notification) => notification.close())
      })
    })
    .catch(() => {
      // ignore
    })
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
      const dosageRecords = prev.dosageRecords.filter((r) => r.childId !== id)
      return { ...prev, children, currentChild, dosageRecords }
    })
  }, [])

  const addDosageRecord = useCallback((record: DosageRecord) => {
    setState((prev) => ({
      ...prev,
      dosageRecords: [record, ...prev.dosageRecords],
    }))
  }, [])

  const updateDosageRecord = useCallback((record: DosageRecord) => {
    setState((prev) => ({
      ...prev,
      dosageRecords: prev.dosageRecords.map((r) => (r.id === record.id ? record : r)),
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

  const resetAppState = useCallback(() => {
    clearSmartdoseStorage()
    cancelSmartdoseNotifications()
    setState(defaultState)
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
        updateDosageRecord,
        deleteDosageRecord,
        setAlarmEnabled,
        setNextDoseTime,
        login,
        logout,
        resetAppState,
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
