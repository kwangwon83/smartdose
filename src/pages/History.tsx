import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pill,
  CalendarCheck,
  ChartBar,
  Clock,
  Timer,
  BellRing,
  Trash2,
  Pencil,
  Share2,
  MessageSquare,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import Layout from '@/components/Layout'
import BottomSheet from '@/components/BottomSheet'
import { useAppContext, type DosageRecord } from '@/contexts/AppContext'
import { showToast } from '@/components/Toast'
import { buildShareText, executeShareTarget, type ShareTarget, type ShareResult } from '@/lib/share'
import {
  isToday,
  isYesterday,
  isThisWeek,
  format,
} from 'date-fns'
import { ko } from 'date-fns/locale'

// ─── Constants ───
const MEDICINE_INFO: Record<
  'acetaminophen' | 'ibuprofen' | 'dexibuprofen',
  { name: string; color: string; bg: string; intervalHours: number }
> = {
  acetaminophen: {
    name: '아세트아미노펜',
    color: '#14B8A6',
    bg: 'rgba(20,184,166,0.1)',
    intervalHours: 4,
  },
  ibuprofen: {
    name: '이부프로펜',
    color: '#F97316',
    bg: 'rgba(249,115,22,0.1)',
    intervalHours: 6,
  },
  dexibuprofen: {
    name: '덱시부프로펜',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.1)',
    intervalHours: 4,
  },
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 10, 20, 30, 40, 50]

// ─── Helpers ───
function formatTimeKorean(date: Date | string) {
  return new Date(date).toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getNextDoseTime(record: DosageRecord): string {
  const custom = record.nextDoseTime
  if (custom) {
    return formatTimeKorean(new Date(custom))
  }
  const d = new Date(record.timestamp)
  const hours = MEDICINE_INFO[record.medicine].intervalHours
  d.setHours(d.getHours() + hours)
  return formatTimeKorean(d)
}

function groupByDate(records: DosageRecord[]) {
  const groups: { label: string; sub: string; records: DosageRecord[] }[] = []
  const today: DosageRecord[] = []
  const yesterday: DosageRecord[] = []
  const earlier = new Map<string, DosageRecord[]>()

  for (const r of records) {
    const d = new Date(r.timestamp)
    if (isToday(d)) {
      today.push(r)
    } else if (isYesterday(d)) {
      yesterday.push(r)
    } else {
      const key = format(d, 'yyyy-MM-dd')
      if (!earlier.has(key)) earlier.set(key, [])
      earlier.get(key)!.push(r)
    }
  }

  if (today.length) {
    groups.push({
      label: '오늘',
      sub: format(new Date(), 'M월 d일 EEEE', { locale: ko }),
      records: today,
    })
  }
  if (yesterday.length) {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    groups.push({
      label: '어제',
      sub: format(y, 'M월 d일 EEEE', { locale: ko }),
      records: yesterday,
    })
  }
  const sortedKeys = Array.from(earlier.keys()).sort().reverse()
  for (const key of sortedKeys) {
    const d = new Date(key)
    groups.push({
      label: format(d, 'M월 d일 EEEE', { locale: ko }),
      sub: '',
      records: earlier.get(key)!,
    })
  }

  return groups
}

// ─── Time Wheel Picker ───
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

  return (
    <div className="flex items-stretch justify-center gap-4 h-[200px]">
      <div className="flex flex-col items-center">
        <span className="text-xs font-medium text-smart-text-muted mb-1">시</span>
        <div
          ref={hourRef}
          className="flex-1 overflow-y-auto w-20 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex flex-col gap-1 py-[80px]">
            {HOURS.map((h) => (
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
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center pt-6">
        <span className="text-xl font-bold text-smart-text-muted">:</span>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-xs font-medium text-smart-text-muted mb-1">분</span>
        <div
          ref={minuteRef}
          className="flex-1 overflow-y-auto w-20 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex flex-col gap-1 py-[80px]">
            {MINUTES.map((m) => (
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
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Swipeable Record Card ───
function SwipeableRecordCard({
  record,
  child,
  onTap,
  onDelete,
}: {
  record: DosageRecord
  child?: { name: string; avatar: string }
  onTap: () => void
  onDelete: () => void
}) {
  const [offsetX, setOffsetX] = useState(0)
  const startX = useRef(0)
  const isSwiping = useRef(false)
  const info = MEDICINE_INFO[record.medicine]

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    isSwiping.current = true
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping.current) return
    const diff = e.touches[0].clientX - startX.current
    if (diff < 0) setOffsetX(Math.max(diff, -88))
    else setOffsetX(0)
  }

  const handleTouchEnd = () => {
    isSwiping.current = false
    if (offsetX < -40) setOffsetX(-88)
    else setOffsetX(0)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX
    isSwiping.current = true
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSwiping.current) return
    const diff = e.clientX - startX.current
    if (diff < 0) setOffsetX(Math.max(diff, -88))
    else setOffsetX(0)
  }

  const handleMouseUp = () => {
    isSwiping.current = false
    if (offsetX < -40) setOffsetX(-88)
    else setOffsetX(0)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete background */}
      <div className="absolute right-0 top-0 bottom-0 w-[88px] bg-smart-danger flex flex-col items-center justify-center text-white">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="flex flex-col items-center gap-1"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-xs font-medium">삭제</span>
        </button>
      </div>

      <motion.div
        animate={{ x: offsetX }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={() => {
          if (offsetX === 0) onTap()
          else setOffsetX(0)
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative bg-white rounded-2xl border border-[#F1F5F9] p-4 flex items-center gap-3 cursor-pointer select-none"
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: info.bg }}
        >
          <Pill className="w-5 h-5" style={{ color: info.color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-smart-text truncate">
              {info.name}
            </span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
              style={{ background: info.color }}
            >
              {record.medicine === 'acetaminophen' ? 'ACET' : 'IBU'}
            </span>
          </div>
          <p className="text-sm text-smart-text-secondary mt-0.5">
            <span className="text-base font-semibold text-smart-text">{record.amountMg}mg</span>
            <span className="text-xs text-smart-text-muted"> ({record.amountMl}ml)</span>
          </p>
          {record.memo && (
            <p className="text-xs text-smart-text-muted mt-0.5 truncate">
              {record.memo}
            </p>
          )}
          {child && (
            <div className="flex items-center gap-1.5 mt-1">
              <img src={child.avatar} alt="" className="w-4 h-4 rounded-full" />
              <span className="text-xs text-smart-text-muted">{child.name}</span>
            </div>
          )}
        </div>

        {/* Time + next dose */}
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-smart-text-secondary">
            {formatTimeKorean(record.timestamp)}
          </p>
          <p className="text-[11px] text-smart-accent mt-0.5 flex items-center justify-end gap-1">
            <Timer className="w-3 h-3" />
            다음 {getNextDoseTime(record)}
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Page ───
export default function History() {
  const navigate = useNavigate()
  const {
    children,
    dosageRecords,
    addDosageRecord,
    deleteDosageRecord,
    updateDosageRecord,
  } = useAppContext()

  const [selectedChildId, setSelectedChildId] = useState<string>('all')
  const [detailRecord, setDetailRecord] = useState<DosageRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [headerShadow, setHeaderShadow] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)

  // Time picker state
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  const [pickerHour, setPickerHour] = useState(0)
  const [pickerMinute, setPickerMinute] = useState(0)

  useEffect(() => {
    const onScroll = () => setHeaderShadow(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const filteredRecords = useMemo(() => {
    let recs = [...dosageRecords].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    if (selectedChildId !== 'all') {
      recs = recs.filter((r) => r.childId === selectedChildId)
    }
    return recs
  }, [dosageRecords, selectedChildId])

  const stats = useMemo(() => {
    const todayCount = filteredRecords.filter((r) =>
      isToday(new Date(r.timestamp))
    ).length
    const thisWeekCount = filteredRecords.filter((r) =>
      isThisWeek(new Date(r.timestamp), { weekStartsOn: 1 })
    ).length
    const lastRecord = filteredRecords[0]
    const lastTime = lastRecord
      ? formatTimeKorean(lastRecord.timestamp)
      : '--:--'

    // Next dose from the latest record overall
    const nextDose = lastRecord ? getNextDoseTime(lastRecord) : null
    return { todayCount, thisWeekCount, lastTime, nextDose, lastRecord }
  }, [filteredRecords])

  const groups = useMemo(() => groupByDate(filteredRecords), [filteredRecords])

  const getChild = useCallback(
    (childId: string) => children.find((c) => c.id === childId),
    [children]
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteDosageRecord(id)
      showToast('기록이 삭제되었어요', 'success')
      setDeleteTarget(null)
      setDetailRecord(null)
    },
    [deleteDosageRecord]
  )

  const handleSaveNote = useCallback(() => {
    if (!detailRecord) return
    const updated: DosageRecord = {
      ...detailRecord,
      memo: noteDraft.trim() || undefined,
    }
    updateDosageRecord(updated)
    setDetailRecord(updated)
    setEditingNote(false)
    showToast('메모가 수정되었어요', 'success')
  }, [detailRecord, noteDraft, updateDosageRecord])

  // ─── Time edit handlers ───
  const handleOpenTimePicker = useCallback(() => {
    if (!detailRecord) return
    const base = detailRecord.nextDoseTime
      ? new Date(detailRecord.nextDoseTime)
      : (() => {
          const d = new Date(detailRecord.timestamp)
          d.setHours(d.getHours() + MEDICINE_INFO[detailRecord.medicine].intervalHours)
          return d
        })()
    setPickerHour(base.getHours())
    setPickerMinute(base.getMinutes())
    setTimePickerOpen(true)
  }, [detailRecord])

  const handleConfirmTimeEdit = useCallback(() => {
    if (!detailRecord) return
    const base = detailRecord.nextDoseTime
      ? new Date(detailRecord.nextDoseTime)
      : (() => {
          const d = new Date(detailRecord.timestamp)
          d.setHours(d.getHours() + MEDICINE_INFO[detailRecord.medicine].intervalHours)
          return d
        })()
    const newDate = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      pickerHour,
      pickerMinute,
      0,
      0
    )
    const updated: DosageRecord = {
      ...detailRecord,
      nextDoseTime: newDate.toISOString(),
    }
    deleteDosageRecord(detailRecord.id)
    addDosageRecord(updated)
    setDetailRecord(updated)
    setTimePickerOpen(false)
    showToast('다음 투약 시간이 수정되었습니다', 'success')
  }, [addDosageRecord, deleteDosageRecord, detailRecord, pickerHour, pickerMinute])

  const handleCancelTimeEdit = useCallback(() => {
    setTimePickerOpen(false)
  }, [])

  const handleResetToAuto = useCallback(() => {
    if (!detailRecord) return
    const updated: DosageRecord = {
      id: detailRecord.id,
      childId: detailRecord.childId,
      medicine: detailRecord.medicine,
      concentration: detailRecord.concentration,
      amountMl: detailRecord.amountMl,
      amountMg: detailRecord.amountMg,
      timestamp: detailRecord.timestamp,
      memo: detailRecord.memo,
    }
    deleteDosageRecord(detailRecord.id)
    addDosageRecord(updated)
    setDetailRecord(updated)
    setTimePickerOpen(false)
    showToast('자동 계산 시간으로 되돌렸어요', 'info')
  }, [addDosageRecord, deleteDosageRecord, detailRecord])


  const handleShareResult = useCallback((result: ShareResult, target: ShareTarget) => {
    void target
    showToast(result.message, result.type)
  }, [])

  const executeDetailShare = useCallback(async (target: ShareTarget) => {
    if (!detailRecord) return

    const child = getChild(detailRecord.childId)
    const text = buildShareText(
      child?.name ?? '아이',
      new Date(detailRecord.timestamp).toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
      MEDICINE_INFO[detailRecord.medicine].name,
      detailRecord.amountMl,
      detailRecord.amountMg,
      getNextDoseTime(detailRecord)
    )

    setShareTarget(target)
    const result = await executeShareTarget(target, text)
    handleShareResult(result, target)
    setShareTarget(null)
  }, [detailRecord, getChild, handleShareResult])

  const chips = [
    { id: 'all', name: '전체', avatar: '' },
    ...children.map((c) => ({ id: c.id, name: c.name, avatar: c.avatar })),
  ]

  const isUrgent =
    stats.lastRecord &&
    new Date().getTime() >=
      new Date(stats.lastRecord.timestamp).getTime() +
        MEDICINE_INFO[stats.lastRecord.medicine].intervalHours * 3600000

  return (
    <Layout>
      {/* ─── Custom Sticky Header ─── */}
      <div
        className={`sticky top-0 z-50 h-14 flex items-center justify-between px-5 bg-white/90 backdrop-blur-md transition-shadow duration-200 ${
          headerShadow ? 'shadow-[0_1px_3px_rgba(0,0,0,0.05)]' : ''
        }`}
        style={{ borderBottom: '1px solid #E2E8F0' }}
      >
        <h1 className="text-xl font-semibold text-smart-text">투약 기록</h1>
      </div>

      <div className="px-5 pt-4 pb-8 flex flex-col gap-5">
        {/* ─── Child Filter Chips ─── */}
        <motion.div
          initial={{ translateY: 10, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{
            duration: 0.3,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
            delay: 0.1,
          }}
          className="flex gap-2 overflow-x-auto scrollbar-none pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {chips.map((chip, i) => {
            const active = selectedChildId === chip.id
            return (
              <motion.button
                key={chip.id}
                initial={{ translateY: 10, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                transition={{
                  duration: 0.3,
                  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                  delay: 0.1 + i * 0.05,
                }}
                onClick={() => setSelectedChildId(chip.id)}
                className={`shrink-0 h-9 flex items-center gap-2 px-4 rounded-full text-sm font-medium transition-transform active:scale-95 ${
                  active
                    ? 'bg-smart-primary text-white shadow-[0_2px_8px_rgba(20,184,166,0.25)]'
                    : 'bg-white text-smart-text-secondary border border-smart-border'
                }`}
              >
                {chip.avatar && (
                  <img src={chip.avatar} alt="" className="w-5 h-5 rounded-full" />
                )}
                {chip.name}
              </motion.button>
            )
          })}
        </motion.div>

        {/* ─── Stats Summary Card ─── */}
        <motion.div
          initial={{ translateY: 20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
            delay: 0.15,
          }}
          className="bg-white rounded-[20px] shadow-card p-5"
        >
          <div className="grid grid-cols-3 divide-x divide-[#F1F5F9]">
            <div className="flex flex-col items-center gap-1">
              <CalendarCheck className="w-4 h-4 text-smart-primary" />
              <span className="text-xl font-bold text-smart-primary">
                {stats.todayCount}
              </span>
              <span className="text-xs text-smart-text-muted">오늘</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ChartBar className="w-4 h-4 text-smart-text-secondary" />
              <span className="text-xl font-bold text-smart-text">
                {stats.thisWeekCount}
              </span>
              <span className="text-xs text-smart-text-muted">이번 주</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Clock className="w-4 h-4 text-smart-text-secondary" />
              <span className="text-lg font-semibold text-smart-text">
                {stats.lastTime}
              </span>
              <span className="text-xs text-smart-text-muted">마지막</span>
            </div>
          </div>

          {stats.nextDose && (
            <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-center gap-1.5">
              {isUrgent ? (
                <BellRing className="w-3.5 h-3.5 text-smart-accent" />
              ) : (
                <Timer className="w-3.5 h-3.5 text-smart-accent" />
              )}
              <span
                className={`text-sm ${
                  isUrgent ? 'text-smart-accent font-medium' : 'text-smart-text-secondary'
                }`}
              >
                다음 투약 가능: {stats.nextDose}
              </span>
            </div>
          )}
        </motion.div>

        {/* ─── Records List ─── */}
        {groups.length === 0 ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
              delay: 0.3,
            }}
            className="flex flex-col items-center gap-4 pt-8"
          >
            <img
              src="/empty-history.svg"
              alt="기록 없음"
              className="w-[120px] h-[120px]"
            />
            <h3 className="text-lg font-medium text-smart-text-secondary text-center">
              아직 투약 기록이 없어요
            </h3>
            <p className="text-sm text-smart-text-muted text-center">
              아이의 체중을 입력하고 용량을 계산해보세요
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-[200px] h-12 rounded-xl bg-smart-primary text-white text-sm font-semibold shadow-float active:scale-[0.97] transition-transform"
            >
              계산하러 가기
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group, gi) => (
              <motion.div
                key={group.label + group.sub}
                initial={{ translateY: 20, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                transition={{
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                  delay: 0.2 + gi * 0.05,
                }}
              >
                {/* Date section header */}
                <div className="flex items-center justify-between py-3 sticky top-14 z-40 bg-smart-bg">
                  <h3 className="text-lg font-semibold text-smart-text flex items-center gap-2">
                    📅 {group.label}
                  </h3>
                  {group.sub && (
                    <span className="text-xs text-smart-text-muted">
                      {group.sub}
                    </span>
                  )}
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2">
                  {group.records.map((record, ri) => {
                    const child = getChild(record.childId)
                    return (
                      <motion.div
                        key={record.id}
                        initial={{ translateY: 10, opacity: 0 }}
                        animate={{ translateY: 0, opacity: 1 }}
                        transition={{
                          duration: 0.3,
                          ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                          delay: 0.25 + gi * 0.05 + ri * 0.05,
                        }}
                      >
                        <SwipeableRecordCard
                          record={record}
                          child={child}
                          onTap={() => {
                            setDetailRecord(record)
                            setNoteDraft(record.memo || '')
                            setEditingNote(false)
                          }}
                          onDelete={() => setDeleteTarget(record.id)}
                        />
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Record Detail Bottom Sheet ─── */}
      <BottomSheet
        isOpen={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        title="투약 상세"
      >
        {detailRecord && (
          <div className="flex flex-col gap-5">
            {/* Medicine badge */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: MEDICINE_INFO[detailRecord.medicine].bg }}
              >
                <Pill
                  className="w-6 h-6"
                  style={{ color: MEDICINE_INFO[detailRecord.medicine].color }}
                />
              </div>
              <div>
                <h4 className="text-base font-semibold text-smart-text">
                  {MEDICINE_INFO[detailRecord.medicine].name}
                </h4>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{
                    background: MEDICINE_INFO[detailRecord.medicine].color,
                  }}
                >
                  {detailRecord.medicine === 'acetaminophen'
                    ? '아세트아미노펜'
                    : '이부프로펜'}
                </span>
              </div>
            </div>

            {/* Info rows */}
            <div className="bg-[#F8FAFC] rounded-xl p-4 flex flex-col gap-3">
              {(() => {
                const child = getChild(detailRecord.childId)
                return child ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-smart-text-secondary">아이</span>
                    <div className="flex items-center gap-2">
                      <img
                        src={child.avatar}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                      <span className="text-sm font-medium text-smart-text">
                        {child.name}
                      </span>
                    </div>
                  </div>
                ) : null
              })()}
              <div className="flex items-center justify-between">
                <span className="text-sm text-smart-text-secondary">투약 시간</span>
                <span className="text-sm font-medium text-smart-text">
                  {new Date(detailRecord.timestamp).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-smart-text-secondary">투약량</span>
                <span className="text-sm font-medium text-smart-text">
                  <span className="text-base font-semibold">{detailRecord.amountMg}mg</span>
                  <span className="text-xs text-smart-text-muted"> ({detailRecord.amountMl}ml)</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-smart-text-secondary">농도</span>
                <span className="text-sm font-medium text-smart-text">
                  {detailRecord.concentration}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-smart-text-secondary">다음 투약 가능</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-smart-accent">
                    {getNextDoseTime(detailRecord)}
                  </span>
                  <button
                    onClick={handleOpenTimePicker}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-smart-primary/10 text-smart-primary text-xs font-medium active:scale-95 transition-transform shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                    수정
                  </button>
                </div>
              </div>
            </div>

            {/* Note */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-smart-text-secondary">메모</span>
                {!editingNote && (
                  <button
                    onClick={() => setEditingNote(true)}
                    className="flex items-center gap-1 text-xs text-smart-primary font-medium"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    수정
                  </button>
                )}
              </div>
              {editingNote ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="메모를 입력하세요"
                    className="w-full min-h-[80px] p-3 rounded-xl border border-smart-border bg-white text-sm text-smart-text outline-none focus:border-smart-primary resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingNote(false)}
                      className="flex-1 h-10 rounded-xl border border-smart-border text-sm text-smart-text-secondary font-medium"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveNote}
                      className="flex-1 h-10 rounded-xl bg-smart-primary text-white text-sm font-medium"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-smart-text bg-white rounded-xl border border-smart-border p-3 min-h-[48px]">
                  {detailRecord.memo || '메모가 없어요'}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => executeDetailShare('kakao')}
                  disabled={shareTarget !== null}
                  className="h-12 rounded-xl bg-[#FEE500] text-smart-text text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-60"
                >
                  <Share2 className="w-4 h-4" />
                  카카오톡
                </button>
                <button
                  onClick={() => executeDetailShare('sms')}
                  disabled={shareTarget !== null}
                  className="h-12 rounded-xl bg-[#F1F5F9] text-smart-text text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-60"
                >
                  <MessageSquare className="w-4 h-4 text-smart-primary" />
                  문자
                </button>
                <button
                  onClick={() => executeDetailShare('share')}
                  disabled={shareTarget !== null}
                  className="h-12 rounded-xl bg-[#F1F5F9] text-smart-text text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-60"
                >
                  <ExternalLink className="w-4 h-4 text-smart-text-secondary" />
                  더보기
                </button>
              </div>
              <button
                onClick={() => {
                  setDetailRecord(null)
                  setDeleteTarget(detailRecord.id)
                }}
                className="w-full h-12 rounded-xl bg-red-50 text-smart-danger text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              >
                <Trash2 className="w-4 h-4" />
                삭제하기
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* ─── Time Picker Bottom Sheet ─── */}
      <BottomSheet
        isOpen={timePickerOpen}
        onClose={handleCancelTimeEdit}
        title="다음 투약 시간 설정"
      >
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

      {/* ─── Delete Confirmation Modal ─── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              className="relative bg-white rounded-[20px] p-6 w-full max-w-[320px] shadow-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
            >
              <div className="flex flex-col items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-smart-danger" />
                </div>
                <h3 className="text-lg font-semibold text-smart-text">
                  정말 삭제할까요?
                </h3>
                <p className="text-sm text-smart-text-secondary text-center">
                  삭제된 기록은 복구할 수 없어요
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 h-12 rounded-xl border border-smart-border text-sm text-smart-text-secondary font-medium active:scale-[0.97] transition-transform"
                >
                  취소
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget)}
                  className="flex-1 h-12 rounded-xl bg-smart-danger text-white text-sm font-semibold active:scale-[0.97] transition-transform"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  )
}
