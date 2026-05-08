import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pill,
  Minus,
  Plus,
  ChevronDown,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  UserCircle,
  FlaskConical,
} from 'lucide-react'
import Layout from '@/components/Layout'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppContext } from '@/contexts/AppContext'
import type { Child } from '@/contexts/AppContext'
import { showToast } from '@/components/Toast'
import * as dosageLib from '@/lib/dosage'
import { getDefaultChildAvatar, isDefaultChildAvatar, readImageFileAsDataUrl, type ChildGender } from '@/lib/children'
import { cn } from '@/lib/utils'


const MEDICINE_INFO: Record<dosageLib.MedicineType, { name: string; maxDoses: number; interval: string; desc: string }> = {
  acetaminophen: {
    name: '아세트아미노펜',
    maxDoses: 4,
    interval: '4시간',
    desc: '해열·진통 / 4시간 간격',
  },
  ibuprofen: {
    name: '이부프로펜',
    maxDoses: 4,
    interval: '6~8시간',
    desc: '해열·소염·진통 / 6~8시간 간격',
  },
  dexibuprofen: {
    name: '덱시부프로펜',
    maxDoses: 4,
    interval: '4~6시간',
    desc: '해열·소염·진통 / 4~6시간 간격',
  },
}


interface ChildFormData {
  name: string
  birthDate: string
  weight: string
  gender: ChildGender
  avatar: string
}

const emptyChildForm: ChildFormData = {
  name: '',
  birthDate: '',
  weight: '15',
  gender: 'male',
  avatar: getDefaultChildAvatar('male'),
}

// ─── Helpers ───
function formatNumber(n: number, digits = 1) {
  return Number(n.toFixed(digits))
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ─── Components ───
function WeightSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const min = 3
  const max = 60
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="w-full">
      <div className="relative h-8 flex items-center">
        <div className="absolute left-0 right-0 h-2 rounded-full bg-[#E2E8F0]" />
        <div
          className="absolute left-0 h-2 rounded-full bg-smart-primary"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={0.1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full h-full opacity-0 cursor-pointer z-10"
        />
        <motion.div
          className="absolute w-6 h-6 rounded-full bg-white border-[3px] border-smart-primary shadow-md pointer-events-none"
          style={{ left: `calc(${pct}% - 12px)` }}
          whileTap={{ scale: 1.2 }}
          transition={{ duration: 0.15 }}
        />
      </div>
      <div className="flex justify-between text-xs text-smart-text-muted mt-1 px-1">
        <span>3kg</span>
        <span>15kg</span>
        <span>30kg</span>
        <span>45kg</span>
        <span>60kg</span>
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { currentChild, children, dosageRecords, setCurrentChild, addChild } = useAppContext()

  const [weight, setWeight] = useState(currentChild?.weight ?? 15)
  const [medicine, setMedicine] = useState<dosageLib.MedicineType>('acetaminophen')
  const [productIndex, setProductIndex] = useState(0)
  const [accordionOpen, setAccordionOpen] = useState<string | null>(null)
  const [childSelectorOpen, setChildSelectorOpen] = useState(false)
  const [childModalOpen, setChildModalOpen] = useState(false)
  const [childForm, setChildForm] = useState<ChildFormData>(emptyChildForm)
  const [childFormErrors, setChildFormErrors] = useState<Partial<Record<keyof ChildFormData, string>>>({})

  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const product = dosageLib.PRODUCTS[medicine][productIndex] ?? dosageLib.PRODUCTS[medicine][0]
  const concentrationOptions = useMemo(
    () => Array.from(new Set(dosageLib.PRODUCTS[medicine].map((p) => p.concentrationLabel))),
    [medicine]
  )
  const filteredProducts = useMemo(
    () =>
      dosageLib.PRODUCTS[medicine]
        .map((p, idx) => ({ product: p, index: idx }))
        .filter(({ product: p }) => p.concentrationLabel === product.concentrationLabel),
    [medicine, product.concentrationLabel]
  )
  const dosage = useMemo(() => dosageLib.calcDosage(weight, medicine, product), [weight, medicine, product])
  const dosageRange = useMemo(() => dosageLib.getDosageDisplayRange(dosage), [dosage])

  const isWeightValid = weight >= 3 && weight <= 60

  const adjustWeight = useCallback(
    (delta: number) => {
      setWeight((w) => {
        const next = formatNumber(Math.max(3, Math.min(60, w + delta)))
        return next
      })
    },
    []
  )

  const startHold = useCallback(
    (delta: number) => {
      adjustWeight(delta)
      holdTimerRef.current = setInterval(() => adjustWeight(delta), 100)
    },
    [adjustWeight]
  )

  const stopHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [])

  const handleRecordClick = () => {
    if (!isWeightValid) {
      showToast('몸무게를 먼저 입력해주세요', 'info')
      return
    }
    dosageLib.savePendingDosageDraft({ medicine, productIndex, weight })
    navigate('/dosage')
  }

  const recentRecords = dosageRecords.slice(0, 3)

  const childDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (childDropdownRef.current && !childDropdownRef.current.contains(e.target as Node)) {
        setChildSelectorOpen(false)
      }
    }
    if (childSelectorOpen) {
      document.addEventListener('mousedown', handler)
    }
    return () => document.removeEventListener('mousedown', handler)
  }, [childSelectorOpen])

  const handleSelectMedicine = useCallback((nextMedicine: dosageLib.MedicineType) => {
    setMedicine(nextMedicine)
    setProductIndex(0)
  }, [])

  const handleSelectConcentration = useCallback((concentrationLabel: string) => {
    const nextIndex = dosageLib.PRODUCTS[medicine].findIndex((p) => p.concentrationLabel === concentrationLabel)
    setProductIndex(nextIndex >= 0 ? nextIndex : 0)
  }, [medicine])

  const onSelectChild = (child: typeof currentChild) => {
    setCurrentChild(child)
    setChildSelectorOpen(false)
    if (child) setWeight(child.weight)
  }

  const onAddChild = useCallback(() => {
    setChildForm({ ...emptyChildForm, weight: String(weight) })
    setChildFormErrors({})
    setChildSelectorOpen(false)
    setChildModalOpen(true)
  }, [weight])

  const handleChildGenderChange = useCallback((gender: ChildGender) => {
    setChildForm((prev) => ({
      ...prev,
      gender,
      avatar: isDefaultChildAvatar(prev.avatar) ? getDefaultChildAvatar(gender) : prev.avatar,
    }))
  }, [])

  const handleChildPhotoChange = useCallback(async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일을 선택해주세요', 'error')
      return
    }
    const avatar = await readImageFileAsDataUrl(file)
    setChildForm((prev) => ({ ...prev, avatar }))
  }, [])

  const saveChildFromModal = useCallback(() => {
    const errors: Partial<Record<keyof ChildFormData, string>> = {}
    const name = childForm.name.trim()
    const childWeight = Number.parseFloat(childForm.weight)
    if (!name || name.length > 20) errors.name = '이름은 1~20자로 입력해주세요'
    if (!childForm.birthDate) errors.birthDate = '생일을 선택해주세요'
    if (Number.isNaN(childWeight) || childWeight < 3 || childWeight > 60) {
      errors.weight = '몸무게는 3~60kg 사이로 입력해주세요'
    }
    setChildFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    const newChild: Child = {
      id: generateId(),
      name,
      birthDate: childForm.birthDate,
      weight: formatNumber(childWeight),
      avatar: childForm.avatar,
      gender: childForm.gender,
    }
    addChild(newChild)
    setCurrentChild(newChild)
    setWeight(newChild.weight)
    setChildModalOpen(false)
    showToast(`${newChild.name} 정보가 추가되었어요`, 'success')
  }, [addChild, childForm, setCurrentChild])

  const info = MEDICINE_INFO[medicine]
  const theme = dosageLib.MEDICINE_THEMES[medicine]
  const maxMg = medicine === 'acetaminophen' ? 500 : 400
  const showAdultWarning = weight >= 40

  return (
    <>
    <Layout>
      {/* ─── Hero ─── */}
      <motion.section
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.1 }}
        className="relative w-full h-[180px] overflow-hidden"
      >
        <img
          src="/hero-illustration.svg"
          alt="hero"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#F8FAFC] to-transparent" />
      </motion.section>

      <div className="px-5 pb-8 flex flex-col gap-6">
        {/* ─── Child Selector ─── */}
        <motion.div
          initial={{ translateY: 20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.2 }}
          ref={childDropdownRef}
          className="relative"
        >
          <button
            onClick={() => setChildSelectorOpen((v) => !v)}
            className="w-full h-12 flex items-center gap-3 px-4 bg-white rounded-xl border border-smart-border text-left"
          >
            <UserCircle className="w-5 h-5 text-smart-text-secondary" />
            <span className="flex-1 text-sm text-smart-text">
              {currentChild ? currentChild.name : '아이를 선택하세요'}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-smart-text-muted transition-transform ${childSelectorOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {childSelectorOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-smart-border shadow-card z-20 overflow-hidden"
              >
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onSelectChild(child)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${
                      currentChild?.id === child.id ? 'bg-smart-primary/5' : ''
                    }`}
                  >
                    <img src={child.avatar} alt="" className="w-8 h-8 rounded-full" />
                    <span className="text-sm text-smart-text font-medium">{child.name}</span>
                    <span className="text-xs text-smart-text-muted ml-auto">{child.weight}kg</span>
                  </button>
                ))}
                <button
                  onClick={onAddChild}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-smart-primary hover:bg-smart-primary/5 border-t border-smart-border"
                >
                  <span className="text-lg leading-none">+</span>
                  <span className="text-sm font-medium">아이 등록하기</span>
                </button>
                {children.length === 0 && (
                  <div className="px-4 py-3 text-xs text-smart-text-muted">
                    등록된 아이가 없습니다
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ─── Weight Input ─── */}
        <motion.div
          initial={{ translateY: 20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.2 }}
          className="flex flex-col gap-4"
        >
          <WeightSlider value={weight} onChange={(v) => setWeight(formatNumber(v))} />

          <div className="flex items-center justify-center gap-3">
            <button
              onMouseDown={() => startHold(-0.1)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={() => startHold(-0.1)}
              onTouchEnd={stopHold}
              className="w-10 h-10 rounded-full border border-smart-border bg-white flex items-center justify-center active:scale-90 transition-transform"
            >
              <Minus className="w-4 h-4 text-smart-text-secondary" />
            </button>

            <motion.div
              key={weight}
              initial={{ scale: 1.05 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
              className="flex items-baseline gap-1"
            >
              <input
                type="number"
                value={weight}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (!isNaN(v) && v >= 3 && v <= 60) setWeight(formatNumber(v))
                  else if (e.target.value === '') setWeight(3)
                }}
                className="w-28 text-center text-[3rem] font-bold text-smart-text bg-transparent border-none outline-none"
                min={3}
                max={60}
                step={0.1}
              />
              <span className="text-base text-smart-text-secondary font-medium">kg</span>
            </motion.div>

            <button
              onMouseDown={() => startHold(0.1)}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onTouchStart={() => startHold(0.1)}
              onTouchEnd={stopHold}
              className="w-10 h-10 rounded-full border border-smart-border bg-white flex items-center justify-center active:scale-90 transition-transform"
            >
              <Plus className="w-4 h-4 text-smart-text-secondary" />
            </button>
          </div>
        </motion.div>

        {/* ─── Medicine Tabs ─── */}
        <motion.div
          initial={{ translateY: 15, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.3 }}
          className="flex flex-col gap-2"
        >
          <div className="flex gap-2">
            {(['acetaminophen', 'ibuprofen', 'dexibuprofen'] as dosageLib.MedicineType[]).map((m) => {
              const active = medicine === m
              return (
                <button
                  key={m}
                  onClick={() => handleSelectMedicine(m)}
                  className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors active:scale-[0.97]"
                  style={{
                    background: active ? dosageLib.MEDICINE_THEMES[m].gradient : '#FFFFFF',
                    borderColor: active ? dosageLib.MEDICINE_THEMES[m].border : '#E2E8F0',
                    color: active ? dosageLib.MEDICINE_THEMES[m].color : '#64748B',
                  }}
                >
                  <Pill className="w-4 h-4" />
                  {MEDICINE_INFO[m].name}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-smart-text-muted text-center">{info.desc}</p>
        </motion.div>

        {/* ─── Result Card ─── */}
        <motion.div
          initial={{ translateY: 30, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.4 }}
          className="rounded-[20px] shadow-card p-6 border"
          style={{ background: theme.gradient, borderColor: theme.border }}
        >
          {/* Card header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: theme.bg }}>
              <Pill className="w-5 h-5" style={{ color: theme.color }} />
            </div>
            <h3 className="text-lg font-semibold text-smart-text">{info.name}</h3>
          </div>

          {isWeightValid ? (
            <>
              {/* Main dosage */}
              <div className="text-center mb-4">
                <p className="text-xs text-smart-text-secondary mb-1">권장 용량</p>
                <motion.div
                  key={`${weight}-${medicine}-${productIndex}`}
                  initial={{ scale: 1.08 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
                  className="flex items-baseline justify-center gap-1"
                >
                  <span className="text-[3rem] font-bold leading-tight"
                    style={{ color: theme.color }}>
                    {formatNumber(dosageRange.min)} ~ {formatNumber(dosageRange.max)}
                  </span>
                  <span className="text-base text-smart-text-secondary font-medium">{dosageRange.unitLabel}</span>
                </motion.div>
                <p className="text-sm text-smart-text-muted mt-1">
                  ({Math.round(dosage.minMg)} ~ {Math.round(dosage.maxMg)}mg)
                </p>
              </div>

              {/* Concentration */}
              <div className="text-center mb-4">
                <p className="text-xs text-smart-text-muted">
                  기준: {product.concentrationLabel}
                </p>
                <p className="text-xs text-smart-text-muted flex items-center justify-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3" />
                  제품에 따라 농도와 포당 함량이 다를 수 있어요
                </p>
              </div>

              {/* Adult warning */}
              {showAdultWarning && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-4 text-center">
                  <p className="text-xs text-orange-600 font-medium">
                    ⚠️ 몸무게 40kg 이상은 성인용량을 참고하세요
                  </p>
                </div>
              )}

              {/* Concentration tabs */}
              <div className="mb-4 flex flex-wrap justify-center gap-2">
                {concentrationOptions.map((concentrationLabel) => {
                  const active = product.concentrationLabel === concentrationLabel
                  return (
                    <button
                      key={concentrationLabel}
                      onClick={() => handleSelectConcentration(concentrationLabel)}
                      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{
                        background: active ? theme.bg : '#FFFFFF',
                        borderColor: active ? theme.border : '#E2E8F0',
                        color: active ? theme.color : '#64748B',
                      }}
                    >
                      {concentrationLabel}
                    </button>
                  )
                })}
              </div>

              {/* Max dose warning */}
              {dosage.maxMg > maxMg && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-center">
                  <p className="text-xs text-red-500 font-medium">
                    ⚠️ 1회 최대 {maxMg}mg를 초과할 수 없어요
                  </p>
                </div>
              )}

              <div className="h-px bg-[#F1F5F9] my-4" />

              {/* Info list */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-smart-success shrink-0" />
                  <span className="text-sm text-smart-text-secondary">
                    투약 간격: 최소 {info.interval}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-smart-success shrink-0" />
                  <span className="text-sm text-smart-text-secondary">
                    1일 최대 {info.maxDoses}회
                  </span>
                </div>
                {currentChild && dosageRecords.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-smart-info shrink-0" />
                    <span className="text-sm text-smart-text-secondary">
                      마지막 투약: {new Date(dosageRecords[0].timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-smart-text-muted">
                몸무게를 입력하면 용량을 계산해드려요
              </p>
            </div>
          )}
        </motion.div>

        {/* ─── Accordion: Products ─── */}
        <motion.div
          initial={{ translateY: 20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.45 }}
          className="flex flex-col gap-2"
        >
          {/* Products accordion */}
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <button
              onClick={() => setAccordionOpen(accordionOpen === 'products' ? null : 'products')}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <span className="text-base font-semibold text-smart-text">사용 가능한 제품</span>
              <ChevronDown
                className={`w-4 h-4 text-smart-text-muted transition-transform duration-300 ${
                  accordionOpen === 'products' ? 'rotate-180' : ''
                }`}
              />
            </button>
            <AnimatePresence>
              {accordionOpen === 'products' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 flex flex-col">
                    {filteredProducts.map(({ product: p, index: idx }) => (
                      <button
                        key={p.name}
                        onClick={() => setProductIndex(idx)}
                        className={`flex items-center justify-between gap-3 py-3 text-left border-b border-[#F1F5F9] last:border-0 ${
                          productIndex === idx ? 'bg-smart-primary/5 -mx-5 px-5 border-l-[3px] border-l-smart-primary' : ''
                        }`}
                      >
                        <div className="w-14 h-14 rounded-xl bg-[#F1F5F9] overflow-hidden shrink-0">
                          <img
                            src={p.imageSrc}
                            alt={`${p.name} 제품 사진`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-smart-text font-medium">{p.name}</p>
                          <p className="text-xs text-smart-text-muted">{p.ingredient} · {p.concentrationLabel}</p>
                          <p className="text-xs text-smart-primary font-semibold mt-0.5">대상: {p.age}</p>
                          <p className="text-xs text-smart-text-muted mt-0.5">{p.doseGuide} · {p.intervalGuide}</p>
                        </div>
                        {productIndex === idx && (
                          <CheckCircle className="w-4 h-4 text-smart-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Warnings accordion */}
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <button
              onClick={() => setAccordionOpen(accordionOpen === 'warnings' ? null : 'warnings')}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <span className="text-base font-semibold text-smart-text">복용 주의사항</span>
              <ChevronDown
                className={`w-4 h-4 text-smart-text-muted transition-transform duration-300 ${
                  accordionOpen === 'warnings' ? 'rotate-180' : ''
                }`}
              />
            </button>
            <AnimatePresence>
              {accordionOpen === 'warnings' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 flex flex-col gap-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-smart-danger shrink-0 mt-0.5" />
                      <p className="text-sm text-smart-text-secondary">3개월 미만 영아는 의사 처방 필수</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-smart-danger shrink-0 mt-0.5" />
                      <p className="text-sm text-smart-text-secondary">간질환, 신장질환 아동은 전문의 상담 필요</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-smart-danger shrink-0 mt-0.5" />
                      <p className="text-sm text-smart-text-secondary">다른 해열제와 동시 복용 금지</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <FlaskConical className="w-4 h-4 text-smart-info shrink-0 mt-0.5" />
                      <p className="text-sm text-smart-text-secondary">정확한 투약기(스포이드/주사기) 사용</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ─── CTA ─── */}
        <motion.div
          initial={{ translateY: 20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.5 }}
        >
          <button
            onClick={handleRecordClick}
            disabled={!isWeightValid}
            className={`w-full h-14 rounded-2xl bg-smart-primary text-white text-base font-semibold flex items-center justify-center gap-2 shadow-float active:scale-[0.97] transition-all ${
              !isWeightValid ? 'opacity-40 pointer-events-none' : 'hover:bg-smart-primary-dark'
            }`}
          >
            <Pill className="w-5 h-5" />
            투약 기록하기
          </button>
        </motion.div>

        {/* ─── Recent Records ─── */}
        {recentRecords.length > 0 && (
          <motion.div
            initial={{ translateY: 20, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay: 0.55 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-smart-text">최근 투약 기록</h3>
              <button
                onClick={() => navigate('/history')}
                className="flex items-center gap-1 text-xs text-smart-primary font-medium"
              >
                전체보기
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {recentRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-white rounded-xl shadow-card p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: dosageLib.MEDICINE_THEMES[record.medicine].bg }}
                    >
                      <Pill className="w-4 h-4" style={{ color: dosageLib.MEDICINE_THEMES[record.medicine].color }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-smart-text">
                        {MEDICINE_INFO[record.medicine].name}
                      </p>
                      <p className="text-xs text-smart-text-muted">
                        {new Date(record.timestamp).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold"
                      style={{ color: dosageLib.MEDICINE_THEMES[record.medicine].color }}
                    >
                      {record.amountMl}{dosageLib.getDoseUnitLabelForConcentration(record.concentration)}
                    </p>
                    <p className="text-xs text-smart-text-muted">{record.amountMg}mg</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </Layout>

    <Dialog open={childModalOpen} onOpenChange={setChildModalOpen}>
      <DialogContent className="max-w-[360px] rounded-[24px] p-0 overflow-hidden gap-0">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold text-center">아이 등록하기</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 mb-5">
            <img
              src={childForm.avatar}
              alt="아이 사진 미리보기"
              className="w-20 h-20 rounded-full object-cover bg-[#F8FAFC] border border-smart-border"
            />
            <label className="h-9 px-4 rounded-full border border-smart-border bg-white text-sm font-semibold text-smart-text-secondary flex items-center justify-center active:scale-[0.98] transition-transform cursor-pointer">
              사진 선택
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void handleChildPhotoChange(e.target.files?.[0])}
              />
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-smart-text mb-1.5 block">이름</label>
              <Input
                value={childForm.name}
                onChange={(e) => setChildForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="아이 이름"
                className={cn('h-12 rounded-xl border-smart-border', childFormErrors.name && 'border-smart-danger')}
              />
              {childFormErrors.name && <p className="mt-1 text-xs text-smart-danger">{childFormErrors.name}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-smart-text mb-1.5 block">몸무게 (kg)</label>
              <Input
                type="number"
                step="0.1"
                min="3"
                max="60"
                value={childForm.weight}
                onChange={(e) => setChildForm((prev) => ({ ...prev, weight: e.target.value }))}
                placeholder="15.0"
                className={cn('h-12 rounded-xl border-smart-border', childFormErrors.weight && 'border-smart-danger')}
              />
              {childFormErrors.weight && <p className="mt-1 text-xs text-smart-danger">{childFormErrors.weight}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-smart-text mb-1.5 block">생일</label>
              <Input
                type="date"
                value={childForm.birthDate}
                onChange={(e) => setChildForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                className={cn('h-12 rounded-xl border-smart-border', childFormErrors.birthDate && 'border-smart-danger')}
              />
              {childFormErrors.birthDate && <p className="mt-1 text-xs text-smart-danger">{childFormErrors.birthDate}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-smart-text mb-1.5 block">성별</label>
              <div className="flex gap-2">
                {(['male', 'female'] as ChildGender[]).map((gender) => (
                  <button
                    key={gender}
                    onClick={() => handleChildGenderChange(gender)}
                    className={cn(
                      'flex-1 h-12 rounded-xl border font-medium text-sm transition-all',
                      childForm.gender === gender
                        ? 'border-smart-primary bg-[rgba(20,184,166,0.08)] text-smart-primary'
                        : 'border-smart-border text-smart-text-secondary',
                    )}
                  >
                    {gender === 'male' ? '남아' : '여아'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={saveChildFromModal}
            className="mt-6 w-full h-12 rounded-xl bg-smart-primary hover:bg-smart-primary-dark text-white font-semibold"
          >
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
