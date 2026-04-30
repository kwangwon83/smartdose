import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
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
} from 'lucide-react'
import Layout from '@/components/Layout'
import BottomSheet from '@/components/BottomSheet'
import { useAppContext } from '@/contexts/AppContext'
import { showToast } from '@/components/Toast'

// ─── Types ───
type MedicineType = 'acetaminophen' | 'ibuprofen'

interface PendingDosage {
  medicine: MedicineType
  productIndex: number
  weight: number
}

interface AlarmData {
  time: string
  childName: string
  medicine: MedicineType
  enabled: boolean
}

// ─── Constants ───
const MEDICINE_NAMES: Record<MedicineType, string> = {
  acetaminophen: '아세트아미노펜',
  ibuprofen: '이부프로펜',
}

const MEDICINE_INTERVAL_HOURS: Record<MedicineType, number> = {
  acetaminophen: 4,
  ibuprofen: 7,
}

const PRODUCTS: Record<MedicineType, { name: string; concentration: number }[]> = {
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

const PENDING_KEY = 'smartdose_pending_dosage'
const ALARM_KEY = 'smartdose_alarm_v1'

// ─── Helpers ───
function formatNumber(n: number, digits = 1) {
  return Number(n.toFixed(digits))
}

function calcDosage(weight: number, medicine: MedicineType, concentration: number) {
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

function addHours(date: Date, hours: number) {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getPendingDosage(): PendingDosage | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return null
}

function savePendingDosage(dosage: PendingDosage) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(dosage))
  } catch {
    // ignore
  }
}

function getAlarm(): AlarmData | null {
  try {
    const raw = localStorage.getItem(ALARM_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return null
}

function saveAlarm(alarm: AlarmData) {
  try {
    localStorage.setItem(ALARM_KEY, JSON.stringify(alarm))
  } catch {
    // ignore
  }
}

function buildShareText(
  childName: string,
  time: string,
  medicine: string,
  doseMl: number,
  doseMg: number,
  nextDoseTime: string
) {
  return `[투약 기록]
아이: ${childName}
시간: ${time}
약품: ${medicine}
용량: ${doseMl}ml (${doseMg}mg)
다음 투약 가능: ${nextDoseTime}`
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

// ─── Main Page ───

export default function DosageAction() {
  const navigate = useNavigate()
  const { currentChild, addDosageRecord, setAlarmEnabled, setNextDoseTime } = useAppContext()

  const [note, setNote] = useState('')
  const [alarmOn, setAlarmOn] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState<'kakao' | 'sms' | 'share' | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // Stable current time (set once on mount)
  const now = useMemo(() => new Date(), [])

  // Derive dosage data
  const pending = useMemo(() => getPendingDosage(), [])
  const medicine: MedicineType = pending?.medicine ?? 'acetaminophen'
  const productIndex = pending?.productIndex ?? 0
  const weight = currentChild?.weight ?? pending?.weight ?? 15
  const product = PRODUCTS[medicine][productIndex] ?? PRODUCTS.acetaminophen[0]

  // Persist current dosage to localStorage so refresh keeps it
  useEffect(() => {
    savePendingDosage({ medicine, productIndex, weight })
  }, [medicine, productIndex, weight])

  // Initialize alarm state from localStorage
  useEffect(() => {
    const alarm = getAlarm()
    if (alarm) setAlarmOn(alarm.enabled)
  }, [])

  const dosage = useMemo(() => calcDosage(weight, medicine, product.concentration), [weight, medicine, product])
  const doseMl = formatNumber((dosage.minMl + dosage.maxMl) / 2)
  const doseMg = Math.round((dosage.minMg + dosage.maxMg) / 2)

  const nextDoseDate = useMemo(() => addHours(now, MEDICINE_INTERVAL_HOURS[medicine]), [now, medicine])
  const currentTimeStr = useMemo(() => formatTime(now), [now])
  const nextDoseTimeStr = useMemo(() => formatTime(nextDoseDate), [nextDoseDate])

  const childName = currentChild?.name ?? '아이'
  const childAvatar = currentChild?.avatar ?? '/child-avatar-1.svg'

  const isFormDirty = note.trim().length > 0 || alarmOn

  const handleBack = useCallback(() => {
    if (isFormDirty) {
      setShowConfirm(true)
    } else {
      navigate('/')
    }
  }, [isFormDirty, navigate])

  const handleToggleAlarm = useCallback(
    async (enabled: boolean) => {
      setAlarmOn(enabled)
      if (enabled) {
        if ('Notification' in window && 'requestPermission' in Notification) {
          try {
            const permission = await Notification.requestPermission()
            if (permission === 'granted') {
              showToast(`${nextDoseTimeStr}에 알람이 설정되었어요`, 'success')
            } else if (permission === 'denied') {
              showToast('알림 설정을 위해 브라우저 설정에서 권한을 허용해주세요', 'error')
            } else {
              showToast('알림 권한이 허용되지 않았어요. 수동으로 확인해주세요.', 'info')
            }
          } catch {
            showToast('알림 권한 요청에 실패했어요', 'error')
          }
        } else {
          showToast('이 브라우저는 알림을 지원하지 않아요', 'info')
        }
        saveAlarm({
          time: nextDoseDate.toISOString(),
          childName,
          medicine,
          enabled: true,
        })
        setAlarmEnabled(true)
        setNextDoseTime(nextDoseDate.toISOString())
      } else {
        saveAlarm({
          time: nextDoseDate.toISOString(),
          childName,
          medicine,
          enabled: false,
        })
        setAlarmEnabled(false)
        setNextDoseTime(null)
      }
    },
    [childName, medicine, nextDoseDate, nextDoseTimeStr, setAlarmEnabled, setNextDoseTime]
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

  const openShare = useCallback((target: 'kakao' | 'sms' | 'share') => {
    setShareTarget(target)
    setShareSheetOpen(true)
  }, [])

  const executeShare = useCallback(() => {
    const text = buildShareText(childName, currentTimeStr, MEDICINE_NAMES[medicine], doseMl, doseMg, nextDoseTimeStr)
    if (shareTarget === 'share') {
      if (typeof navigator.share === 'function') {
        navigator
          .share({ title: '투약 기록', text })
          .then(() => {
            showToast('공유가 완료되었어요', 'success')
          })
          .catch(() => {
            showToast('공유가 취소되었어요', 'info')
          })
      } else {
        navigator.clipboard
          ?.writeText(text)
          .then(() => showToast('클립보드에 복사되었어요', 'success'))
          .catch(() => showToast('공유할 수 없어요', 'error'))
      }
    } else if (shareTarget === 'sms') {
      window.location.href = `sms:?body=${encodeURIComponent(text)}`
      showToast('문자 앱을 열었어요', 'success')
    } else if (shareTarget === 'kakao') {
      navigator.clipboard
        ?.writeText(text)
        .then(() => showToast('클립보드에 복사되었어요. 카카오톡에 붙여넣기 해주세요', 'success'))
        .catch(() => showToast('공유할 수 없어요. 앱이 설치되어 있는지 확인해주세요.', 'error'))
    }
    setShareSheetOpen(false)
  }, [childName, currentTimeStr, medicine, doseMl, doseMg, nextDoseTimeStr, shareTarget])

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
              <span className="text-base font-medium text-smart-text">{MEDICINE_NAMES[medicine]}</span>
            </motion.div>
            <motion.div className="flex items-center gap-3" variants={cardItemVariants}>
              <Droplets className="w-4 h-4 text-smart-primary shrink-0" />
              <span className="text-base font-semibold text-smart-primary">
                {doseMl}ml ({doseMg}mg)
              </span>
            </motion.div>
            <motion.div className="flex items-center gap-3" variants={cardItemVariants}>
              <Timer className="w-4 h-4 text-smart-text-muted shrink-0" />
              <span className="text-sm text-smart-text-secondary">
                다음 투약: {nextDoseTimeStr} 이후
              </span>
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
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-smart-text-secondary">
                      다음 투약 가능 시간: {nextDoseTimeStr}
                    </p>
                    <p className="text-sm text-smart-text-secondary">
                      {nextDoseTimeStr}에 알림을 보내드릴게요
                    </p>
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
              배우자나 가족에게 투약 정보를 보내세요
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
                {MEDICINE_NAMES[medicine]} {doseMl}ml
              </p>
              <p className="text-sm text-white/80">{currentTimeStr} 투약</p>
            </div>
            <div className="relative z-10 flex justify-end">
              <span className="text-xs text-white/70 font-medium">SmartDose</span>
            </div>
          </motion.div>

          <div className="bg-[#F8FAFC] rounded-xl p-4">
            <p className="text-sm text-smart-text-secondary whitespace-pre-wrap font-sans">
              {buildShareText(childName, currentTimeStr, MEDICINE_NAMES[medicine], doseMl, doseMg, nextDoseTimeStr)}
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
