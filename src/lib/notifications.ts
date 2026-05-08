export type DoseMedicine = 'acetaminophen' | 'ibuprofen'

export interface DoseAlarmData {
  time: string
  childName: string
  medicine: DoseMedicine
  enabled: boolean
}

export const SMARTDOSE_ALARM_KEY = 'smartdose_alarm_v1'

const MEDICINE_NAMES: Record<DoseMedicine, string> = {
  acetaminophen: '아세트아미노펜',
  ibuprofen: '이부프로펜',
}

const scheduledTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
const DEFAULT_NOTIFICATION_TAG = 'smartdose-next-dose'

function isBrowser() {
  return typeof window !== 'undefined'
}

function getNotificationBody(alarm: DoseAlarmData) {
  return `${alarm.childName}의 ${MEDICINE_NAMES[alarm.medicine]} 다음 투약 가능 시간이에요.`
}

function getNotificationTitle() {
  return 'SmartDose 투약 알림'
}

export function getStoredDoseAlarm(): DoseAlarmData | null {
  if (!isBrowser()) return null

  try {
    const raw = window.localStorage.getItem(SMARTDOSE_ALARM_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<DoseAlarmData>
    if (
      typeof parsed.time === 'string' &&
      typeof parsed.childName === 'string' &&
      (parsed.medicine === 'acetaminophen' || parsed.medicine === 'ibuprofen') &&
      typeof parsed.enabled === 'boolean'
    ) {
      return parsed as DoseAlarmData
    }
  } catch {
    // ignore malformed storage values
  }

  return null
}

function persistAlarm(alarm: DoseAlarmData) {
  if (!isBrowser()) return

  try {
    window.localStorage.setItem(SMARTDOSE_ALARM_KEY, JSON.stringify(alarm))
  } catch {
    // ignore storage failures
  }
}

function clearStoredAlarm() {
  if (!isBrowser()) return

  try {
    window.localStorage.removeItem(SMARTDOSE_ALARM_KEY)
  } catch {
    // ignore storage failures
  }
}

function clearScheduledTimeout(id: string) {
  const timeoutId = scheduledTimeouts.get(id)
  if (!timeoutId) return

  clearTimeout(timeoutId)
  scheduledTimeouts.delete(id)
}

async function showDoseNotification(alarm: DoseAlarmData) {
  const title = getNotificationTitle()
  const options: NotificationOptions = {
    body: getNotificationBody(alarm),
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: DEFAULT_NOTIFICATION_TAG,
    data: { time: alarm.time, medicine: alarm.medicine },
  }

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration?.active) {
      registration.showNotification(title, options)
      return
    }
  }

  new Notification(title, options)
}

export async function registerNotificationServiceWorker() {
  if (!isBrowser() || !('serviceWorker' in navigator)) return null

  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export function cancelDoseNotification(options: { clearStorage?: boolean } = {}) {
  clearScheduledTimeout(DEFAULT_NOTIFICATION_TAG)

  if (options.clearStorage) {
    clearStoredAlarm()
    return
  }

  const alarm = getStoredDoseAlarm()
  if (alarm) {
    persistAlarm({ ...alarm, enabled: false })
  }
}

export async function scheduleDoseNotification(alarm: DoseAlarmData) {
  if (!isBrowser()) return false

  clearScheduledTimeout(DEFAULT_NOTIFICATION_TAG)

  const targetTime = new Date(alarm.time).getTime()
  const delay = targetTime - Date.now()

  if (!alarm.enabled || Number.isNaN(targetTime) || delay <= 0) {
    persistAlarm({ ...alarm, enabled: false })
    return false
  }

  persistAlarm(alarm)
  await registerNotificationServiceWorker()

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false
  }

  const timeoutId = setTimeout(() => {
    void showDoseNotification(alarm)
    scheduledTimeouts.delete(DEFAULT_NOTIFICATION_TAG)
    persistAlarm({ ...alarm, enabled: false })
  }, delay)

  scheduledTimeouts.set(DEFAULT_NOTIFICATION_TAG, timeoutId)
  return true
}

export async function restoreScheduledNotifications() {
  const alarm = getStoredDoseAlarm()

  if (!alarm?.enabled) return false

  const targetTime = new Date(alarm.time).getTime()
  if (Number.isNaN(targetTime) || targetTime <= Date.now()) {
    persistAlarm({ ...alarm, enabled: false })
    return false
  }

  return scheduleDoseNotification(alarm)
}
