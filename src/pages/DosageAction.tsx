import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  ChevronLeft,
  Clock,
  Scale,
  Pill,
  Droplets,
  Timer,
  Bell,
  Share as ShareIcon,
  MessageSquare,
  ExternalLink,
  Save,
  CheckCircle,
  Loader2,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import Layout from '@/components/Layout'
import BottomSheet from '@/components/BottomSheet'
import { useAppContext } from '@/contexts/AppContext'
import { showToast } from '@/components/Toast'
import * as dosageLib from '@/lib/dosage'
import { buildShareText, executeShareTarget, type ShareTarget } from '@/lib/share'

// ─── Constants ───

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 10, 20, 30, 40, 50]

const ALARM_KEY = 'smartdose_alarm_v1'
const MANUAL_TIME_KEY = 'smartdose_manual_time_v1'
// ─── Helpers ───

function formatNumber(n: number, digits = 1) {
  return Number(n.toFixed(digits))
}

function calcDosage(weight: number, medicine: dosageLib.MedicineType, concentration: number) {
  const range = medicine === 'acetaminophen' ? [10, 15] : [5, 10]
  const minMg = weight * range[0]
  const maxMg = weight * range[1]
  const minMl = (minMg / concentration) * 5
  const maxMl = (maxMg / concentration) * 5
  return { minMg, maxMg, minMl, maxMl }
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** 한국어 오전/오후 형식으로 시간 포맷팅 (date-fns 사용) */
function formatKoreanTime(date: Date) {
  return format(date, 'a h:mm', { locale: ko })
}

function addHours(date: Date, hours: number) {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getAlarm(): dosageLib.DoseAlarmData | null {
  try {
    const raw = localStorage.getItem(ALARM_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return null
}

function scheduleDoseNotification(alarm: dosageLib.DoseAlarmData) {
  try {
    localStorage.setItem(ALARM_KEY, JSON.stringify(alarm))
  } catch {
    // ignore
  }
}

function cancelDoseNotification() {
  try {
    localStorage.removeItem(ALARM_KEY)
  } catch {
    // ignore
  }
}

/** 수동 설정된 시간을 localStorage에서 불러오기 */
function getManualTime(): string | null {
  try {
    const raw = localStorage.getItem(MANUAL_TIME_KEY)
    if (raw) return raw
  } catch {
    // ignore
  }
  return null
}

/** 수동 설정된 시간을 Date 객체로 변환 */
function getManualNextDoseDate(): Date | null {
  const saved = getManualTime()
  if (!saved) return null

  const parsed = new Date(saved)
  return isNaN(parsed.getTime()) ? null : parsed
}

function saveManualTime(time: string | null) {
  try {
    if (time) {
      localStorage.setItem(MANUAL_TIME_KEY, time)
    } else {
      localStorage.removeItem(MANUAL_TIME_KEY)
    }
  } catch {
    // ignore
  }
}

// ─── Sub-components ───

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-[52px] h-8 rounded-full transition-colors duration-200 ${
        checked ? 'bg-smart-primary' : 'bg-[#E2E8F0]'
      }`}
      aria-pressed={checked}
    >
      <motion.div
        className="absolute top-[2px] left-[2px] w-7 h-7 bg-white rounded-full shadow-sm"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      />
    </button>
  )
}

function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative bg-white rounded-[20px] max-w-[320px] w-full p-6 shadow-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
          >
            <h3 className="text-lg font-semibold text-smart-text text-center mb-2">{title}</h3>
            <p className="text-sm text-smart-text-secondary text-center mb-6">{message}</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 h-12 rounded-xl bg-[#F1F5F9] text-smart-text font-semibold text-sm active:scale-[0.97] transition-transform"
              >
                취소
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 h-12 rounded-xl bg-smart-primary text-white font-semibold text-sm active:scale-[0.97] transition-transform"
              >
                확인
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** 시간 선택 바퀴 (Scrollable Wheel Picker) */
function TimeWheelPicker({
  hours,
  minutes,
  onChangeHours,
  onChangeMinutes,
}: {
  hours: number
  minutes: number
  onChangeHours: (h: number) => void
  onChangeMinutes: (m: number) => void
}) {
  const hourRef = useRef<HTMLDivElement>(null)
  const minuteRef = useRef<HTMLDivElement>(null)

  // 선택된 항목으로 스크롤
  useEffect(() => {
    if (hourRef.current) {
      const selected = hourRef.current.querySelector(`[data-hour="${hours}"]`)
      if (selected) {
        selected.scrollIntoView({ behavior: 'instant', block: 'center' })
      }
    }
  }, [hours])

  useEffect(() => {
    if (minuteRef.current) {
      const selected = minuteRef.current.querySelector(`[data-minute="${minutes}"]`)
      if (selected) {
        selected.scrollIntoView({ behavior: 'instant', block: 'center' })
      }
    }
  }, [minutes])

  const renderHourItems = () =>
    HOURS.map((h) => (
      <button
        key={h}
        data-hour={h}
        onClick={() => onChangeHours(h)}
        className={`h-10 flex items-center justify-center text-lg font-medium rounded-lg transition-colors shrink-0 ${
          h === hours
            ? 'text-smart-primary font-bold bg-smart-primary/10'
            : 'text-smart-text-secondary hover:bg-[#F1F5F9]'
        }`}
      >
        {h.toString().padStart(2, '0')}
      </button>
    ))

  const renderMinuteItems = () =>
    MINUTES.map((m) => (
      <button
        key={m}
        data-minute={m}
        onClick={() => onChangeMinutes(m)}
        className={`h-10 flex items-center justify-center text-lg font-medium rounded-lg transition-colors shrink-0 ${
          m === minutes
            ? 'text-smart-primary font-bold bg-smart-primary/10'
            : 'text-smart-text-secondary hover:bg-[#F1F5F9]'
        }`}
      >
        {m.toString().padStart(2, '0')}
      </button>
    ))

  return (
    <div className="flex items-stretch justify-center gap-4 h-[200px]">
      {/* 시 (Hours) */}
      <div className="flex flex-col items-center">
        <span className="text-xs font-medium text-smart-text-muted mb-1">시</span>
        <div
          ref={hourRef}
          className="flex-1 overflow-y-auto w-20 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex flex-col gap-1 py-[80px]">{renderHourItems()}</div>
        </div>
      </div>

      {/* 구분자 */}
      <div className="flex items-center pt-6">
        <span className="text-xl font-bold text-smart-text-muted">:</span>
      </div>

      {/* 분 (Minutes) */}
      <div className="flex flex-col items-center">
        <span className="text-xs font-medium text-smart-text-muted mb-1">분</span>
        <div
          ref={minuteRef}
          className="flex-1 overflow-y-auto w-20 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex flex-col gap-1 py-[80px]">{renderMinuteItems()}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───

export default function DosageAction() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentChild, addDosageRecord, setAlarmEnabled, setNextDoseTime } = useAppContext()

  const [note, setNote] = useState('')
  const [alarmOn, setAlarmOn] = useState(() => getAlarm()?.enabled ?? false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // ─── 다음 투약 시간 관련 상태 ───
  // 시간 편집 BottomSheet 열림 여부
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  // 수동으로 설정된 다음 투약 시간 (null이면 자동 계산 사용)
  const [manualNextDoseDate, setManualNextDoseDate] = useState<Date | null>(() => getManualNextDoseDate())
  // 수동 편집 여부 플래그
  const [isManualEdit, setIsManualEdit] = useState(() => manualNextDoseDate !== null)
  // 편집 중인 시/분 (picker 상태)
  const [pickerHour, setPickerHour] = useState(0)
  const [pickerMinute, setPickerMinute] = useState(0)

  // Stable current time (set once on mount)
  const now = useMemo(() => new Date(), [])

  // Derive dosage data
  const pending = useMemo(() => dosageLib.getPendingDosage(), [])
  const prefs = useMemo(() => dosageLib.loadDosagePrefs(), [])
  const medicine: dosageLib.MedicineType = pending?.medicine ?? prefs.defaultMedicine
  const productIndex = pending?.productIndex ?? dosageLib.getProductIndexForPreference(medicine, prefs.defaultConcentration)
  const weight = currentChild?.weight ?? pending?.weight ?? 15
  const product = dosageLib.PRODUCTS[medicine][productIndex] ?? dosageLib.PRODUCTS.acetaminophen[0]

  // Persist current dosage to localStorage so refresh keeps it
  useEffect(() => {
    dosageLib.savePendingDosageDraft({ medicine, productIndex, weight })
  }, [medicine, productIndex, weight])

  const dosage = useMemo(() => calcDosage(weight, medicine, product.concentration), [weight, medicine, product])
  const doseMl = formatNumber((dosage.minMl + dosage.maxMl) / 2)
  const doseMg = Math.round((dosage.minMg + dosage.maxMg) / 2)

  // 자동 계산된 다음 투약 시간
  const autoNextDoseDate = useMemo(() => addHours(now, dosageLib.MEDICINE_INTERVAL_HOURS[medicine]), [now, medicine])

  // 실제 사용할 다음 투약 시간 (수동 설정 우선)
  const nextDoseDate = manualNextDoseDate ?? autoNextDoseDate

  const currentTimeStr = useMemo(() => formatTime(now), [now])
  const nextDoseTimeStr = useMemo(() => formatTime(nextDoseDate), [nextDoseDate])
  const nextDoseKoreanStr = useMemo(() => formatKoreanTime(nextDoseDate), [nextDoseDate])

  const childName = currentChild?.name ?? '아이'
  const childAvatar = currentChild?.avatar ?? '/child-avatar-1.svg'

  const isFormDirty = note.trim().length > 0 || alarmOn || isManualEdit

  const handleBack = useCallback(() => {
    if (isFormDirty) {
      setShowConfirm(true)
    } else {
      navigate('/')
    }
  }, [isFormDirty, navigate])

  /** 알람 토글 - 현재 표시된 시간(수동/자동) 기준으로 설정 */
  const handleToggleAlarm = useCallback(
    async (enabled: boolean) => {
      const targetDate = nextDoseDate
      const alarm: DoseAlarmData = {
        time: targetDate.toISOString(),
        childName,
        medicine,
        enabled,
      }

      if (enabled) {
        if (!('Notification' in window) || !('requestPermission' in Notification)) {
          showToast('이 브라우저는 알림을 지원하지 않아요', 'info')
          return
        }

        try {
          const permission =
            Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()

          if (permission !== 'granted') {
            setAlarmOn(false)
            if (permission === 'denied') {
              showToast('알림 설정을 위해 브라우저 설정에서 권한을 허용해주세요', 'error')
            } else {
              showToast('알림 권한이 허용되지 않았어요. 수동으로 확인해주세요.', 'info')
            }
            return
          }

          const scheduled = await scheduleDoseNotification(alarm)
          if (!scheduled) {
            setAlarmOn(false)
            showToast('이미 지난 시간이라 알람을 설정하지 못했어요', 'error')
            return
          }

          setAlarmOn(true)
          setAlarmEnabled(true)
          setNextDoseTime(targetDate.toISOString())
          showToast(`${formatTime(targetDate)}에 알람이 설정되었어요`, 'success')
        } catch {
          setAlarmOn(false)
          showToast('알림 권한 요청에 실패했어요', 'error')
        }
        scheduleDoseNotification({
          time: targetDate.toISOString(),
          childName,
          medicine,
          enabled: true,
        })
        setAlarmEnabled(true)
        setNextDoseTime(targetDate.toISOString())
      } else {
        cancelDoseNotification()
        setAlarmEnabled(false)
        setNextDoseTime(null)
      }
    },
    [childName, medicine, nextDoseDate, setAlarmEnabled, setNextDoseTime]
  )

  const handleSave = useCallback(async () => {
    if (!currentChild) {
      showToast('아이 정보를 먼저 등록해주세요', 'error')
      return
    }
    setIsSaving(true)
    await new Promise((r) => setTimeout(r, 600))
    const record = {
      id: generateId(),
      childId: currentChild.id,
      medicine,
      concentration: `${product.concentration}mg/5ml`,
      amountMl: doseMl,
      amountMg: doseMg,
      timestamp: now.toISOString(),
      memo: note.trim() || undefined,
      nextDoseTime: nextDoseDate.toISOString(),
    }
    addDosageRecord(record)
    setNextDoseTime(nextDoseDate.toISOString())
    setIsSaving(false)
    setSaveSuccess(true)
    showToast('투약 기록이 저장되었어요', 'success')
    setTimeout(() => {
      navigate('/history')
    }, 800)
  }, [currentChild, medicine, product, doseMl, doseMg, now, note, addDosageRecord, setNextDoseTime, nextDoseDate, navigate])

  const openShare = useCallback((target: ShareTarget) => {
    setShareTarget(target)
    setShareSheetOpen(true)
  }, [])

  const executeShare = useCallback(async () => {
    if (!shareTarget) return

    const text = buildShareText(childName, currentTimeStr, dosageLib.MEDICINE_NAMES[medicine], doseMl, doseMg, nextDoseTimeStr)
    const result = await executeShareTarget(shareTarget, text)
    showToast(result.message, result.type)
    setShareSheetOpen(false)
  }, [childName, currentTimeStr, medicine, doseMl, doseMg, nextDoseTimeStr, shareTarget, handleShareResult])

  // ─── 시간 편집 핸들러 ───

  /** 시간 편집 버튼 탭 → BottomSheet 열기 */
  const handleOpenTimePicker = useCallback(() => {
    const base = manualNextDoseDate ?? autoNextDoseDate
    setPickerHour(base.getHours())
    setPickerMinute(base.getMinutes())
    setTimePickerOpen(true)
  }, [manualNextDoseDate, autoNextDoseDate])

  /** 확인 버튼 → 수동 시간 적용 */
  const handleConfirmTimeEdit = useCallback(() => {
    const nowDate = new Date()
    const newDate = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate(),
      pickerHour,
      pickerMinute,
      0,
      0
    )
    // 설정하려는 시간이 현재보다 이전이면 내일로 설정
    if (newDate.getTime() <= nowDate.getTime()) {
      newDate.setDate(newDate.getDate() + 1)
    }
    setManualNextDoseDate(newDate)
    setIsManualEdit(true)
    saveManualTime(newDate.toISOString())
    if (alarmOn && 'Notification' in window && Notification.permission === 'granted') {
      void scheduleDoseNotification({
        time: newDate.toISOString(),
        childName,
        medicine,
        enabled: true,
      })
      setNextDoseTime(newDate.toISOString())
    }
    setTimePickerOpen(false)
    showToast('다음 투약 시간이 수동 설정되었어요', 'success')
  }, [alarmOn, childName, medicine, pickerHour, pickerMinute, setNextDoseTime])

  /** 취소 버튼 → BottomSheet 닫기 */
  const handleCancelTimeEdit = useCallback(() => {
    setTimePickerOpen(false)
  }, [])

  /** 자동 계산 버튼 → 수동 설정 해제 */
  const handleResetToAuto = useCallback(() => {
    setManualNextDoseDate(null)
    setIsManualEdit(false)
    saveManualTime(null)
    if (alarmOn && 'Notification' in window && Notification.permission === 'granted') {
      void scheduleDoseNotification({
        time: autoNextDoseDate.toISOString(),
        childName,
        medicine,
        enabled: true,
      })
      setNextDoseTime(autoNextDoseDate.toISOString())
    }
    setTimePickerOpen(false)
    showToast('자동 계산 시간으로 되돌렸어요', 'info')
  }, [alarmOn, autoNextDoseDate, childName, medicine, setNextDoseTime])

  // Animation helpers
  const cardItemVariants = {
    hidden: { opacity: 0, x: -10 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  }

  return (
    <Layout showHeader={false} showNav={true}>
      {/* Custom Header */}
      <motion.header
        className="sticky top-0 z-50 h-14 flex items-center px-5 bg-white/90 backdrop-blur-md"
        style={{ borderBottom: '1px solid #E2E8F0' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-smart-text active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6" />
          <span className="text-base font-semibold">투약 기록</span>
        </button>
      </motion.header>

      <div className="px-5 py-4 flex flex-col gap-6 pb-8">
        {/* ─── Dosage Info Card ─── */}
        <motion.div
          className="bg-white rounded-[20px] shadow-card p-6"
          initial={{ translateY: 20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.1 }}
        >
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src={childAvatar} alt="" className="w-10 h-10 rounded-full" />
              <h2 className="text-xl font-semibold text-smart-text">{childName}</h2>
            </div>
            <div className="flex items-center gap-1 text-sm text-smart-text-secondary">
              <Clock className="w-4 h-4" />
              <span>{currentTimeStr}</span>
            </div>
          </div>

          <div className="h-px bg-[#F1F5F9] mb-4" />

          {/* Info List */}
          <motion.div
            className="flex flex-col gap-3"
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.06, delayChildren: 0.15 }}
          >
            <motion.div className="flex items-center gap-3" variants={cardItemVariants}>
              <Scale className="w-4 h-4 text-smart-text-muted shrink-0" />
              <span className="text-base font-medium text-smart-text">{weight}kg</span>
            </motion.div>
            <motion.div className="flex items-center gap-3" variants={cardItemVariants}>
              <Pill className="w-4 h-4 text-smart-text-muted shrink-0" />
              <span className="text-base font-medium text-smart-text">{dosageLib.MEDICINE_NAMES[medicine]}</span>
            </motion.div>
            <motion.div className="flex items-center gap-3" variants={cardItemVariants}>
              <Droplets className="w-4 h-4 text-smart-primary shrink-0" />
              <span className="text-base font-semibold text-smart-primary">
                {doseMl}ml ({doseMg}mg)
              </span>
            </motion.div>
            {/* 다음 투약 시간 + 편집 버튼 */}
            <motion.div className="flex items-center gap-3" variants={cardItemVariants}>
              <Timer className="w-4 h-4 text-smart-text-muted shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm text-smart-text-secondary">
                  다음 투약: {nextDoseTimeStr} 이후
                </span>
                {/* 시간 편집 버튼 */}
                <button
                  onClick={handleOpenTimePicker}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-smart-primary/10 text-smart-primary text-xs font-medium active:scale-95 transition-transform shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                  수정
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* ─── Memo Input ─── */}
        <motion.div
          initial={{ translateY: 15, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.2 }}
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`메모를 입력하세요 (선택사항)\n예: 체온 38.5도, 식후 투약`}
            className="w-full min-h-[80px] max-h-[120px] rounded-2xl border border-smart-border bg-white p-4 text-sm text-smart-text placeholder:text-smart-text-muted resize-none outline-none focus:border-smart-primary focus:shadow-[0_0_0_3px_rgba(20,184,166,0.1)] transition-all"
          />
        </motion.div>

        {/* ─── Alarm Section ─── */}
        <motion.div
          initial={{ translateY: 15, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-smart-primary" />
              <h3 className="text-lg font-semibold text-smart-text">다음 투약 알람</h3>
            </div>
            <ToggleSwitch checked={alarmOn} onChange={handleToggleAlarm} />
          </div>

          <AnimatePresence>
            {alarmOn && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="overflow-hidden"
              >
                <div className="rounded-xl bg-smart-primary/[0.08] p-3 px-4 flex items-start gap-3">
                  <Bell className="w-5 h-5 text-smart-primary shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1 flex-1">
                    <p className="text-sm text-smart-text-secondary">
                      다음 투약 가능 시간: <span className="font-semibold text-smart-text">{nextDoseKoreanStr}</span>
                    </p>
                    <p className="text-sm text-smart-text-secondary">
                      {nextDoseKoreanStr}에 알림을 본내드릴게요
                    </p>
                    {/* 수동 설정 / 자동 계산 배지 */}
                    <div className="mt-1">
                      {isManualEdit ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-smart-accent/10 text-smart-accent text-[11px] font-medium">
                          수동 설정
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F1F5F9] text-smart-text-muted text-[11px] font-medium">
                          자동 계산
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-smart-text-muted mt-2 px-1">
                  iOS에서는 알림이 제한될 수 있어요
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ─── Share Section ─── */}
        <motion.div
          initial={{ translateY: 15, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.4 }}
        >
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <ShareIcon className="w-5 h-5 text-smart-text-secondary" />
              <h3 className="text-lg font-semibold text-smart-text">투약 내용 공유</h3>
            </div>
            <p className="text-sm text-smart-text-muted">
              배우자나 가족에게 투약 정보를 본내세요
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => openShare('kakao')}
              className="flex flex-col items-center gap-2 active:scale-[0.92] transition-transform"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#FEE500] flex items-center justify-center">
                <img src="/kakao-icon.svg" alt="카카오톡" className="w-8 h-8" />
              </div>
              <span className="text-xs text-smart-text-secondary">카카오톡</span>
            </button>
            <button
              onClick={() => openShare('sms')}
              className="flex flex-col items-center gap-2 active:scale-[0.92] transition-transform"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-smart-primary" />
              </div>
              <span className="text-xs text-smart-text-secondary">문자</span>
            </button>
            <button
              onClick={() => openShare('share')}
              className="flex flex-col items-center gap-2 active:scale-[0.92] transition-transform"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center">
                <ExternalLink className="w-7 h-7 text-smart-text-secondary" />
              </div>
              <span className="text-xs text-smart-text-secondary">더보기</span>
            </button>
          </div>
        </motion.div>

        {/* ─── CTA ─── */}
        <motion.div
          initial={{ translateY: 20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.5 }}
        >
          <button
            onClick={handleSave}
            disabled={isSaving || saveSuccess}
            className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-semibold shadow-float active:scale-[0.97] transition-all ${
              saveSuccess
                ? 'bg-smart-success text-white'
                : 'bg-smart-primary text-white hover:bg-smart-primary-dark'
            } ${isSaving || saveSuccess ? 'pointer-events-none' : ''}`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                저장 중...
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle className="w-5 h-5" />
                저장 완료!
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                기록 저장하기
              </>
            )}
          </button>
        </motion.div>
      </div>

      {/* ─── Share Preview Bottom Sheet ─── */}
      <BottomSheet isOpen={shareSheetOpen} onClose={() => setShareSheetOpen(false)} title="공유 미리보기">
        <div className="flex flex-col gap-5">
          <motion.div
            className="relative overflow-hidden rounded-2xl shadow-card p-6 min-h-[160px] flex flex-col justify-between"
            style={{
              backgroundImage: 'url(/share-pattern.svg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-smart-primary/80 to-smart-primary-dark/90" />
            <div className="relative z-10 flex flex-col gap-1">
              <p className="text-xs text-white/80 font-medium">투약 기록</p>
              <p className="text-base text-white">
                {childName} / {weight}kg
              </p>
              <p className="text-lg font-semibold text-white">
                {dosageLib.MEDICINE_NAMES[medicine]} {doseMl}ml
              </p>
              <p className="text-sm text-white/80">{currentTimeStr} 투약</p>
            </div>
            <div className="relative z-10 flex justify-end">
              <span className="text-xs text-white/70 font-medium">SmartDose</span>
            </div>
          </motion.div>

          <div className="bg-[#F8FAFC] rounded-xl p-4">
            <p className="text-sm text-smart-text-secondary whitespace-pre-wrap font-sans">
              {buildShareText(childName, currentTimeStr, dosageLib.MEDICINE_NAMES[medicine], doseMl, doseMg, nextDoseTimeStr)}
            </p>
          </div>

          <button
            onClick={executeShare}
            className="w-full h-14 rounded-2xl bg-smart-primary text-white text-base font-semibold flex items-center justify-center gap-2 shadow-float active:scale-[0.97] transition-all hover:bg-smart-primary-dark"
          >
            <ShareIcon className="w-5 h-5" />
            공유하기
          </button>
        </div>
      </BottomSheet>

      {/* ─── Time Picker Bottom Sheet ─── */}
      <BottomSheet isOpen={timePickerOpen} onClose={handleCancelTimeEdit} title="다음 투약 시간 설정">
        <div className="flex flex-col gap-5">
          {/* 현재 선택된 시간 미리보기 */}
          <div className="flex items-center justify-center py-2">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-smart-text">
                {format(
                  new Date(2000, 0, 1, pickerHour, pickerMinute),
                  'a h:mm',
                  { locale: ko }
                )}
              </span>
            </div>
          </div>

          {/* 휠 피커 */}
          <TimeWheelPicker
            hours={pickerHour}
            minutes={pickerMinute}
            onChangeHours={setPickerHour}
            onChangeMinutes={setPickerMinute}
          />

          {/* 버튼 영역 */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleConfirmTimeEdit}
              className="w-full h-14 rounded-2xl bg-smart-primary text-white text-base font-semibold flex items-center justify-center shadow-float active:scale-[0.97] transition-all hover:bg-smart-primary-dark"
            >
              확인
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleResetToAuto}
                className="flex-1 h-12 rounded-xl bg-[#F1F5F9] text-smart-text-secondary font-medium text-sm flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
                자동 계산
              </button>
              <button
                onClick={handleCancelTimeEdit}
                className="flex-1 h-12 rounded-xl bg-[#F1F5F9] text-smart-text font-medium text-sm flex items-center justify-center active:scale-[0.97] transition-transform"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* ─── Cancel Confirm Modal ─── */}
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => navigate('/')}
        title="투약 기록을 취소할까요?"
        message="작성 중인 내용이 사라집니다."
      />
    </Layout>
  )
}
