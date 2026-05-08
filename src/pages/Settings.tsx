import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  UserCircle,
  Plus,
  Pencil,
  Bell,
  Pill,
  Droplets,
  User,
  CloudUpload,
  Info,
  Shield,
  FileText,
  LogOut,
  Trash2,
  ChevronRight,
  LogIn,
  CheckCircle2,
  Baby,
  Mail,
  Check,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Layout from '@/components/Layout'
import { useAppContext } from '@/contexts/AppContext'
import type { Child } from '@/contexts/AppContext'
import { showToast } from '@/components/Toast'
import { cn } from '@/lib/utils'

const STORAGE_PREFS_KEY = 'smartdose_prefs_v1'

const SUPPORT_CONTACT_METHODS = ['mailto', 'external', 'in_app'] as const

type SupportContactMethod = (typeof SUPPORT_CONTACT_METHODS)[number]

function getEnvValue(key: string): string | undefined {
  const value = import.meta.env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const APP_VERSION = getEnvValue('VITE_APP_VERSION') ?? '1.0.0'
const SUPPORT_EMAIL = getEnvValue('VITE_SUPPORT_EMAIL') ?? 'support@smartdose.app'
const SUPPORT_CONTACT_URL = getEnvValue('VITE_SUPPORT_CONTACT_URL')
const SUPPORT_FORM_PATH = getEnvValue('VITE_SUPPORT_FORM_PATH')

function isSupportContactMethod(value: string | undefined): value is SupportContactMethod {
  return SUPPORT_CONTACT_METHODS.some((method) => method === value)
}

function getSupportContactMethod(): SupportContactMethod {
  const configuredMethod = getEnvValue('VITE_SUPPORT_CONTACT_METHOD')
  if (isSupportContactMethod(configuredMethod)) return configuredMethod
  return 'mailto'
}

function getDiagnosticInfo(provider: string): string {
  const diagnostics = [
    `앱 버전: ${APP_VERSION}`,
    `브라우저: ${navigator.userAgent}`,
    `로그인 provider: ${provider}`,
  ]
  return diagnostics.join('\n')
}

function buildSupportMailto(provider: string): string {
  const subject = '[SmartDose] 문의하기'
  const body = [
    '문의 내용을 작성해주세요.',
    '',
    '--- 진단 정보(선택) ---',
    getDiagnosticInfo(provider),
  ].join('\n')

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

async function copySupportUrlToClipboard(url: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false

  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    return false
  }
}

interface Prefs {
  defaultMedicine: 'acetaminophen' | 'ibuprofen'
  defaultConcentration: string
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {
    defaultMedicine: 'acetaminophen',
    defaultConcentration: '100mg/5ml',
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

function getAgeText(birthDate: string): string {
  const birth = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (now.getDate() < birth.getDate()) {
    months--
  }
  if (months < 0) {
    years--
    months += 12
  }
  if (years > 0 && months > 0) return `${years}세 ${months}개월`
  if (years > 0) return `${years}세`
  if (months > 0) return `${months}개월`
  return '신생아'
}

function getInitials(name: string): string {
  return name.slice(0, 2)
}

function getProviderIcon(provider: string): string {
  switch (provider) {
    case 'kakao':
      return '/kakao-icon.svg'
    case 'naver':
      return '/naver-icon.svg'
    case 'google':
      return '/google-icon.svg'
    default:
      return ''
  }
}

const sectionVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
}

const menuGroupVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
}

const staggerContainer = {
  visible: {
    transition: { staggerChildren: 0.06 },
  },
}

const childCardVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}

interface ChildFormData {
  name: string
  birthDate: string
  weight: string
  gender: 'male' | 'female'
}

const emptyForm: ChildFormData = {
  name: '',
  birthDate: '',
  weight: '',
  gender: 'male',
}

const medicineOptions: { value: 'acetaminophen' | 'ibuprofen'; label: string }[] = [
  { value: 'acetaminophen', label: '아세트아미노펜' },
  { value: 'ibuprofen', label: '이부프로펜' },
]

const concentrationOptions: Record<string, string[]> = {
  acetaminophen: ['100mg/5ml', '120mg/5ml', '160mg/5ml'],
  ibuprofen: ['100mg/5ml'],
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function Settings() {
  const {
    isLoggedIn,
    userProfile,
    children,
    currentChild,
    alarmEnabled,
    dosageRecords,
    setCurrentChild,
    addChild,
    updateChild,
    removeChild,
    setAlarmEnabled,
    deleteDosageRecord,
    logout,
    resetAppState,
  } = useAppContext()

  const navigate = useNavigate()
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)

  // Modals
  const [childModalOpen, setChildModalOpen] = useState(false)
  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [childForm, setChildForm] = useState<ChildFormData>(emptyForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ChildFormData, string>>>({})

  const [deleteChildId, setDeleteChildId] = useState<string | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [withdrawStep2, setWithdrawStep2] = useState(false)
  const [withdrawInput, setWithdrawInput] = useState('')
  const [confirmDeleteRecords, setConfirmDeleteRecords] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showAppInfo, setShowAppInfo] = useState(false)
  const [showMedicineModal, setShowMedicineModal] = useState(false)
  const [showConcentrationModal, setShowConcentrationModal] = useState(false)

  useEffect(() => {
    savePrefs(prefs)
  }, [prefs])

  const openAddChild = useCallback(() => {
    setEditingChild(null)
    setChildForm(emptyForm)
    setFormErrors({})
    setChildModalOpen(true)
  }, [])

  const openEditChild = useCallback((child: Child) => {
    setEditingChild(child)
    const gender = child.avatar.includes('child-avatar-2') ? 'female' : 'male'
    setChildForm({
      name: child.name,
      birthDate: child.birthDate,
      weight: String(child.weight),
      gender,
    })
    setFormErrors({})
    setChildModalOpen(true)
  }, [])

  const validateChildForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof ChildFormData, string>> = {}
    if (!childForm.name.trim() || childForm.name.trim().length < 1 || childForm.name.trim().length > 20) {
      errors.name = '이름은 1~20자로 입력해주세요'
    }
    if (!childForm.birthDate) {
      errors.birthDate = '생년월일을 선택해주세요'
    }
    const weightNum = parseFloat(childForm.weight)
    if (isNaN(weightNum) || weightNum < 1.0 || weightNum > 100.0) {
      errors.weight = '몸무게는 1.0~100.0kg 사이로 입력해주세요'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [childForm])

  const saveChild = useCallback(() => {
    if (!validateChildForm()) return
    const weight = parseFloat(parseFloat(childForm.weight).toFixed(1))
    const avatar = childForm.gender === 'female' ? '/child-avatar-2.svg' : '/child-avatar-1.svg'
    if (editingChild) {
      const updated: Child = { ...editingChild, name: childForm.name.trim(), birthDate: childForm.birthDate, weight, avatar }
      updateChild(updated)
      showToast('정보가 수정되었어요', 'success')
    } else {
      const newChild: Child = {
        id: generateId(),
        name: childForm.name.trim(),
        birthDate: childForm.birthDate,
        weight,
        avatar,
      }
      addChild(newChild)
      showToast(`${newChild.name} 정보가 추가되었어요`, 'success')
    }
    setChildModalOpen(false)
  }, [childForm, editingChild, validateChildForm, addChild, updateChild])

  const handleDeleteChild = useCallback(() => {
    if (!deleteChildId) return
    const child = children.find((c) => c.id === deleteChildId)
    removeChild(deleteChildId)
    showToast('삭제되었어요', 'success')
    setDeleteChildId(null)
    if (child && currentChild?.id === child.id) {
      // currentChild is already updated by removeChild in context
    }
  }, [deleteChildId, children, removeChild, currentChild])

  const handleLogout = useCallback(() => {
    logout()
    setConfirmLogout(false)
    showToast('로그아웃 되었어요', 'info')
  }, [logout])

  const handleWithdraw = useCallback(() => {
    if (!withdrawStep2) {
      setWithdrawStep2(true)
      return
    }
    if (withdrawInput.trim() !== '탈퇴합니다') {
      showToast('확인 문구를 정확히 입력해주세요', 'error')
      return
    }
    resetAppState()
    setConfirmWithdraw(false)
    setWithdrawStep2(false)
    setWithdrawInput('')
    showToast('탈퇴가 완료되었어요', 'success')
    navigate('/')
  }, [withdrawStep2, withdrawInput, resetAppState, navigate])

  const handleExportRecords = useCallback(() => {
    if (dosageRecords.length === 0) {
      showToast('보낼 기록이 없어요', 'info')
      return
    }
    const data = JSON.stringify(dosageRecords, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smartdose-records-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('기록을보냈어요', 'success')
  }, [dosageRecords])

  const handleDeleteRecords = useCallback(() => {
    dosageRecords.forEach((r) => deleteDosageRecord(r.id))
    setConfirmDeleteRecords(false)
    showToast('모든 기록이 삭제되었어요', 'success')
  }, [dosageRecords, deleteDosageRecord])

  const handleToggleAlarm = useCallback(
    (checked: boolean) => {
      setAlarmEnabled(checked)
      showToast(checked ? '푸시 알림이 설정되었어요' : '푸시 알림이 꺼졌어요', 'info')
    },
    [setAlarmEnabled],
  )

  const handleContactSupport = useCallback(async () => {
    const provider = userProfile?.provider ?? 'guest'
    const contactMethod = getSupportContactMethod()

    if (contactMethod === 'mailto') {
      try {
        window.location.assign(buildSupportMailto(provider))
        showToast('메일 앱으로 연결을 시도했어요. 문의 내용을 작성해 보내주세요.', 'info')
      } catch {
        showToast('메일 앱으로 연결할 수 없어요. 이메일 주소를 직접 입력해주세요.', 'error')
      }
      return
    }

    if (contactMethod === 'external') {
      if (!SUPPORT_CONTACT_URL) {
        showToast('고객센터 주소가 설정되어 있지 않아요.', 'error')
        return
      }

      const supportWindow = window.open(SUPPORT_CONTACT_URL, '_blank')
      if (supportWindow) {
        supportWindow.opener = null
        showToast('고객센터를 새 창에서 열었어요.', 'success')
        return
      }

      const copied = await copySupportUrlToClipboard(SUPPORT_CONTACT_URL)
      showToast(
        copied
          ? '새 창을 열 수 없어 고객센터 주소를 복사했어요.'
          : '새 창을 열 수 없어요. 팝업 차단을 해제하거나 고객센터 주소를 직접 입력해주세요.',
        copied ? 'info' : 'error',
      )
      return
    }

    if (!SUPPORT_FORM_PATH) {
      showToast('문의 폼 경로가 설정되어 있지 않아요.', 'error')
      return
    }

    navigate(SUPPORT_FORM_PATH)
    showToast('문의 폼으로 이동했어요.', 'success')
  }, [navigate, userProfile?.provider])

  const handleSelectMedicine = useCallback((value: 'acetaminophen' | 'ibuprofen') => {
    setPrefs((prev) => ({
      ...prev,
      defaultMedicine: value,
      defaultConcentration: concentrationOptions[value][0],
    }))
    setShowMedicineModal(false)
    showToast('기본 약품이 변경되었어요', 'success')
  }, [])

  const handleSelectConcentration = useCallback((value: string) => {
    setPrefs((prev) => ({ ...prev, defaultConcentration: value }))
    setShowConcentrationModal(false)
    showToast('기본 시럽 농도가 변경되었어요', 'success')
  }, [])

  const currentMedicineLabel = useMemo(
    () => medicineOptions.find((m) => m.value === prefs.defaultMedicine)?.label ?? prefs.defaultMedicine,
    [prefs.defaultMedicine],
  )

  const menuItemClass =
    'flex items-center gap-3 px-5 h-14 bg-white active:bg-[rgba(20,184,166,0.04)] transition-colors cursor-pointer'

  return (
    <Layout>
      <div className="px-5 pt-4 pb-8 space-y-6 max-w-[430px] mx-auto">
        {/* Profile Section */}
        <motion.div
          custom={0.1}
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[20px] shadow-card p-6"
        >
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div
                className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold',
                  isLoggedIn ? 'bg-[rgba(20,184,166,0.1)] text-smart-primary' : 'bg-gray-100 text-smart-text-muted',
                )}
              >
                {isLoggedIn && userProfile ? (
                  <span>{getInitials(userProfile.name)}</span>
                ) : (
                  <UserCircle className="w-8 h-8" />
                )}
              </div>
              {isLoggedIn && userProfile && (
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full overflow-hidden border-2 border-white bg-white">
                  <img
                    src={getProviderIcon(userProfile.provider)}
                    alt={userProfile.provider}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
            <h3 className="mt-3 text-lg font-semibold text-smart-text">
              {isLoggedIn && userProfile ? `${userProfile.name} 님` : '게스트'}
            </h3>
            {isLoggedIn && userProfile ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-smart-primary text-white text-xs font-medium">
                  로그인 중
                </span>
                {userProfile.email && (
                  <span className="text-xs text-smart-text-muted">{userProfile.email}</span>
                )}
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm text-smart-text-muted">로그인하고 기록을 동기화하세요</p>
                <Button
                  onClick={() => navigate('/login')}
                  className="mt-3 h-10 px-6 rounded-xl bg-smart-primary hover:bg-smart-primary-dark text-white font-semibold text-sm w-40"
                >
                  <LogIn className="w-4 h-4 mr-1.5" />
                  로그인하기
                </Button>
              </>
            )}
          </div>
        </motion.div>

        {/* Children Section */}
        <motion.div
          custom={0.2}
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-smart-text">내 아이들</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-smart-primary text-white text-xs font-medium">
              {children.length}명
            </span>
          </div>

          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
            {children.map((child) => {
              const isCurrent = currentChild?.id === child.id
              return (
                <motion.div
                  key={child.id}
                  variants={childCardVariants}
                  className={cn(
                    'bg-white rounded-2xl border p-4 flex items-center gap-3 cursor-pointer transition-all',
                    isCurrent ? 'border-smart-primary shadow-[0_0_0_1px_#14B8A6]' : 'border-[#F1F5F9]',
                  )}
                  onClick={() => setCurrentChild(child)}
                >
                  <img
                    src={child.avatar}
                    alt={child.name}
                    className="w-12 h-12 rounded-full object-cover bg-gray-50"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-smart-text">{child.name}</span>
                      {isCurrent && <CheckCircle2 className="w-4 h-4 text-smart-primary" />}
                    </div>
                    <div className="text-sm text-smart-text-secondary">
                      {child.weight}kg
                    </div>
                    <div className="text-xs text-smart-text-muted">
                      {child.birthDate} · {getAgeText(child.birthDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditChild(child)
                      }}
                      className="p-2 rounded-full hover:bg-gray-100 active:scale-95 transition-transform"
                    >
                      <Pencil className="w-5 h-5 text-smart-text-muted" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteChildId(child.id)
                      }}
                      className="p-2 rounded-full hover:bg-gray-100 active:scale-95 transition-transform"
                    >
                      <Trash2 className="w-5 h-5 text-smart-danger" />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          <button
            onClick={openAddChild}
            className="mt-2 w-full h-12 rounded-2xl border border-dashed border-[rgba(20,184,166,0.3)] bg-[rgba(20,184,166,0.08)] flex items-center justify-center gap-1.5 text-smart-primary font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" />
            아이 추가하기
          </button>
        </motion.div>

        {/* Preferences Group */}
        <motion.div custom={0.3} variants={menuGroupVariants} initial="hidden" animate="visible">
          <div className="bg-white rounded-2xl border border-[#F1F5F9] overflow-hidden">
            <div className={menuItemClass}>
              <Bell className="w-6 h-6 text-smart-text-secondary shrink-0" />
              <span className="flex-1 text-sm font-medium text-smart-text">알림 설정</span>
              <Switch checked={alarmEnabled} onCheckedChange={handleToggleAlarm} />
            </div>
            <div className="h-px bg-[#F1F5F9] mx-5" />
            <button
              onClick={() => setShowMedicineModal(true)}
              className={cn(menuItemClass, 'w-full')}
            >
              <Pill className="w-6 h-6 text-smart-text-secondary shrink-0" />
              <span className="flex-1 text-sm font-medium text-smart-text">기본 약품</span>
              <span className="text-sm text-smart-text-muted flex items-center gap-1">
                {currentMedicineLabel}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
            <div className="h-px bg-[#F1F5F9] mx-5" />
            <button
              onClick={() => setShowConcentrationModal(true)}
              className={cn(menuItemClass, 'w-full')}
            >
              <Droplets className="w-6 h-6 text-smart-text-secondary shrink-0" />
              <span className="flex-1 text-sm font-medium text-smart-text">기본 시럽 농도</span>
              <span className="text-sm text-smart-text-muted flex items-center gap-1">
                {prefs.defaultConcentration}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
            <div className="h-px bg-[#F1F5F9] mx-5" />
            <div className={menuItemClass}>
              <Baby className="w-6 h-6 text-smart-text-secondary shrink-0" />
              <span className="flex-1 text-sm font-medium text-smart-text">체중 단위</span>
              <span className="text-sm text-smart-text-muted">kg</span>
            </div>
          </div>
        </motion.div>

        {/* Data Management Group */}
        <motion.div custom={0.4} variants={menuGroupVariants} initial="hidden" animate="visible">
          <div className="bg-white rounded-2xl border border-[#F1F5F9] overflow-hidden">
            <button onClick={handleExportRecords} className={cn(menuItemClass, 'w-full')}>
              <CloudUpload className="w-6 h-6 text-smart-text-secondary shrink-0" />
              <span className="flex-1 text-sm font-medium text-smart-text">투약 기록 보내기</span>
              <ChevronRight className="w-4 h-4 text-smart-text-muted" />
            </button>
            <div className="h-px bg-[#F1F5F9] mx-5" />
            <button
              onClick={() => setConfirmDeleteRecords(true)}
              className={cn(menuItemClass, 'w-full')}
            >
              <Trash2 className="w-6 h-6 text-smart-danger shrink-0" />
              <span className="flex-1 text-sm font-medium text-smart-danger">기록 삭제</span>
              <ChevronRight className="w-4 h-4 text-smart-text-muted" />
            </button>
          </div>
        </motion.div>

        {/* Account Group */}
        <motion.div custom={0.5} variants={menuGroupVariants} initial="hidden" animate="visible">
          <div className="bg-white rounded-2xl border border-[#F1F5F9] overflow-hidden">
            {!isLoggedIn ? (
              <button onClick={() => navigate('/login')} className={cn(menuItemClass, 'w-full')}>
                <User className="w-6 h-6 text-smart-text-secondary shrink-0" />
                <span className="flex-1 text-sm font-medium text-smart-text">로그인</span>
                <ChevronRight className="w-4 h-4 text-smart-text-muted" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => setConfirmLogout(true)}
                  className={cn(menuItemClass, 'w-full')}
                >
                  <LogOut className="w-6 h-6 text-smart-text-secondary shrink-0" />
                  <span className="flex-1 text-sm font-medium text-smart-text">로그아웃</span>
                  <ChevronRight className="w-4 h-4 text-smart-text-muted" />
                </button>
                <div className="h-px bg-[#F1F5F9] mx-5" />
                <button
                  onClick={() => setConfirmWithdraw(true)}
                  className={cn(menuItemClass, 'w-full')}
                >
                  <Trash2 className="w-6 h-6 text-smart-danger shrink-0" />
                  <span className="flex-1 text-sm font-medium text-smart-danger">회원탈퇴</span>
                  <ChevronRight className="w-4 h-4 text-smart-text-muted" />
                </button>
              </>
            )}
          </div>
        </motion.div>

        {/* App Info Group */}
        <motion.div custom={0.6} variants={menuGroupVariants} initial="hidden" animate="visible">
          <div className="bg-white rounded-2xl border border-[#F1F5F9] overflow-hidden">
            <button onClick={() => setShowAppInfo(true)} className={cn(menuItemClass, 'w-full')}>
              <Info className="w-6 h-6 text-smart-text-secondary shrink-0" />
              <span className="flex-1 text-sm font-medium text-smart-text">앱 정보</span>
              <span className="text-sm text-smart-text-muted flex items-center gap-1">
                v{APP_VERSION}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
            <div className="h-px bg-[#F1F5F9] mx-5" />
            <button onClick={() => setShowPrivacy(true)} className={cn(menuItemClass, 'w-full')}>
              <Shield className="w-6 h-6 text-smart-text-secondary shrink-0" />
              <span className="flex-1 text-sm font-medium text-smart-text">개인정보 처리방침</span>
              <ChevronRight className="w-4 h-4 text-smart-text-muted" />
            </button>
            <div className="h-px bg-[#F1F5F9] mx-5" />
            <button onClick={() => setShowTerms(true)} className={cn(menuItemClass, 'w-full')}>
              <FileText className="w-6 h-6 text-smart-text-secondary shrink-0" />
              <span className="flex-1 text-sm font-medium text-smart-text">이용약관</span>
              <ChevronRight className="w-4 h-4 text-smart-text-muted" />
            </button>
            <div className="h-px bg-[#F1F5F9] mx-5" />
            <button
              onClick={handleContactSupport}
              className={cn(menuItemClass, 'w-full')}
            >
              <Mail className="w-6 h-6 text-smart-text-secondary shrink-0" />
              <span className="flex-1 text-sm font-medium text-smart-text">문의하기</span>
              <ChevronRight className="w-4 h-4 text-smart-text-muted" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Child Add/Edit Modal */}
      <Dialog open={childModalOpen} onOpenChange={setChildModalOpen}>
        <DialogContent className="max-w-[340px] rounded-[20px] p-0 overflow-hidden gap-0">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg font-semibold text-center">
                {editingChild ? '아이 정보 수정' : '아이 정보'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-smart-text mb-1.5 block">이름</label>
                <Input
                  value={childForm.name}
                  onChange={(e) => setChildForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="아이 이름"
                  className={cn(
                    'h-12 rounded-xl border-smart-border focus:border-smart-primary focus:ring-smart-primary',
                    formErrors.name && 'border-smart-danger',
                  )}
                />
                {formErrors.name && <p className="mt-1 text-xs text-smart-danger">{formErrors.name}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-smart-text mb-1.5 block">생년월일</label>
                <Input
                  type="date"
                  value={childForm.birthDate}
                  onChange={(e) => setChildForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                  className={cn(
                    'h-12 rounded-xl border-smart-border focus:border-smart-primary focus:ring-smart-primary',
                    formErrors.birthDate && 'border-smart-danger',
                  )}
                />
                {formErrors.birthDate && (
                  <p className="mt-1 text-xs text-smart-danger">{formErrors.birthDate}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-smart-text mb-1.5 block">성별</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChildForm((prev) => ({ ...prev, gender: 'male' }))}
                    className={cn(
                      'flex-1 h-12 rounded-xl border font-medium text-sm transition-all',
                      childForm.gender === 'male'
                        ? 'border-smart-primary bg-[rgba(20,184,166,0.08)] text-smart-primary'
                        : 'border-smart-border text-smart-text-secondary',
                    )}
                  >
                    남아
                  </button>
                  <button
                    onClick={() => setChildForm((prev) => ({ ...prev, gender: 'female' }))}
                    className={cn(
                      'flex-1 h-12 rounded-xl border font-medium text-sm transition-all',
                      childForm.gender === 'female'
                        ? 'border-smart-primary bg-[rgba(20,184,166,0.08)] text-smart-primary'
                        : 'border-smart-border text-smart-text-secondary',
                    )}
                  >
                    여아
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-smart-text mb-1.5 block">
                  기본 몸무게 (kg)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="100"
                  value={childForm.weight}
                  onChange={(e) => setChildForm((prev) => ({ ...prev, weight: e.target.value }))}
                  placeholder="15.2"
                  className={cn(
                    'h-12 rounded-xl border-smart-border focus:border-smart-primary focus:ring-smart-primary',
                    formErrors.weight && 'border-smart-danger',
                  )}
                />
                {formErrors.weight && <p className="mt-1 text-xs text-smart-danger">{formErrors.weight}</p>}
              </div>
            </div>
            <Button
              onClick={saveChild}
              className="mt-6 w-full h-12 rounded-xl bg-smart-primary hover:bg-smart-primary-dark text-white font-semibold"
            >
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Child Confirm */}
      <Dialog open={!!deleteChildId} onOpenChange={() => setDeleteChildId(null)}>
        <DialogContent className="max-w-[320px] rounded-[20px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">아이 정보 삭제</DialogTitle>
            <DialogDescription className="text-center text-sm text-smart-text-secondary">
              정말 삭제할까요? 관련 투약 기록도 함께 삭제되며 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteChildId(null)}
              className="flex-1 h-12 rounded-xl border-smart-border"
            >
              취소
            </Button>
            <Button
              onClick={handleDeleteChild}
              className="flex-1 h-12 rounded-xl bg-smart-danger hover:bg-red-600 text-white"
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logout Confirm */}
      <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <DialogContent className="max-w-[320px] rounded-[20px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">로그아웃할까요?</DialogTitle>
            <DialogDescription className="text-center text-sm text-smart-text-secondary">
              로컬 기록은 유지되지만 동기화는 중단돼요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmLogout(false)}
              className="flex-1 h-12 rounded-xl border-smart-border"
            >
              취소
            </Button>
            <Button
              onClick={handleLogout}
              className="flex-1 h-12 rounded-xl bg-smart-primary hover:bg-smart-primary-dark text-white"
            >
              로그아웃
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Confirm */}
      <Dialog
        open={confirmWithdraw}
        onOpenChange={(open) => {
          setConfirmWithdraw(open)
          if (!open) {
            setWithdrawStep2(false)
            setWithdrawInput('')
          }
        }}
      >
        <DialogContent className="max-w-[320px] rounded-[20px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">
              {withdrawStep2 ? '확인이 필요해요' : '정말 탈퇴할까요?'}
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-smart-text-secondary">
              {withdrawStep2
                ? "'탈퇴합니다'를 입력해주세요"
                : '모든 기록이 삭제되고 복구할 수 없어요.'}
            </DialogDescription>
          </DialogHeader>
          {withdrawStep2 && (
            <Input
              value={withdrawInput}
              onChange={(e) => setWithdrawInput(e.target.value)}
              placeholder="탈퇴합니다"
              className="h-12 rounded-xl border-smart-border focus:border-smart-primary mt-2"
            />
          )}
          <DialogFooter className="flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmWithdraw(false)
                setWithdrawStep2(false)
                setWithdrawInput('')
              }}
              className="flex-1 h-12 rounded-xl border-smart-border"
            >
              취소
            </Button>
            <Button
              onClick={handleWithdraw}
              className="flex-1 h-12 rounded-xl bg-smart-danger hover:bg-red-600 text-white"
            >
              {withdrawStep2 ? '탈퇴' : '계속'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Records Confirm */}
      <Dialog open={confirmDeleteRecords} onOpenChange={setConfirmDeleteRecords}>
        <DialogContent className="max-w-[320px] rounded-[20px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">기록 삭제</DialogTitle>
            <DialogDescription className="text-center text-sm text-smart-text-secondary">
              모든 투약 기록을 삭제할까요? 이 작업은 되돌릴 수 없어요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteRecords(false)}
              className="flex-1 h-12 rounded-xl border-smart-border"
            >
              취소
            </Button>
            <Button
              onClick={handleDeleteRecords}
              className="flex-1 h-12 rounded-xl bg-smart-danger hover:bg-red-600 text-white"
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Medicine Selector Modal */}
      <Dialog open={showMedicineModal} onOpenChange={setShowMedicineModal}>
        <DialogContent className="max-w-[320px] rounded-[20px] p-0 overflow-hidden gap-0">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg font-semibold text-center">기본 약품 선택</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {medicineOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelectMedicine(option.value)}
                  className={cn(
                    'w-full h-14 rounded-xl border flex items-center px-4 gap-3 transition-all',
                    prefs.defaultMedicine === option.value
                      ? 'border-smart-primary bg-[rgba(20,184,166,0.08)]'
                      : 'border-smart-border',
                  )}
                >
                  <span
                    className={cn(
                      'flex-1 text-left text-sm font-medium',
                      prefs.defaultMedicine === option.value ? 'text-smart-primary' : 'text-smart-text',
                    )}
                  >
                    {option.label}
                  </span>
                  {prefs.defaultMedicine === option.value && (
                    <Check className="w-5 h-5 text-smart-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Concentration Selector Modal */}
      <Dialog open={showConcentrationModal} onOpenChange={setShowConcentrationModal}>
        <DialogContent className="max-w-[320px] rounded-[20px] p-0 overflow-hidden gap-0">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-lg font-semibold text-center">시럽 농도 선택</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {concentrationOptions[prefs.defaultMedicine].map((option) => (
                <button
                  key={option}
                  onClick={() => handleSelectConcentration(option)}
                  className={cn(
                    'w-full h-14 rounded-xl border flex items-center px-4 gap-3 transition-all',
                    prefs.defaultConcentration === option
                      ? 'border-smart-primary bg-[rgba(20,184,166,0.08)]'
                      : 'border-smart-border',
                  )}
                >
                  <span
                    className={cn(
                      'flex-1 text-left text-sm font-medium',
                      prefs.defaultConcentration === option ? 'text-smart-primary' : 'text-smart-text',
                    )}
                  >
                    {option}
                  </span>
                  {prefs.defaultConcentration === option && (
                    <Check className="w-5 h-5 text-smart-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Modal */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-[320px] rounded-[20px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">개인정보 처리방침</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto text-sm text-smart-text-secondary space-y-3 mt-2">
            <p>SmartDose는 사용자의 개인정보를 중요하게 생각합니다.</p>
            <p>
              <strong className="text-smart-text">1. 수집하는 정보</strong>
              <br />
              - 소셜 로그인 제공자 정보 (카카오, 네이버, 구글)
              - 아이 프로필 정보 (이름, 생년월일, 몸무게)
              - 투약 기록
            </p>
            <p>
              <strong className="text-smart-text">2. 이용 목적</strong>
              <br />
              - 해열제 용량 계산
              - 투약 기록 관리
              - 알림 서비스 제공
            </p>
            <p>
              <strong className="text-smart-text">3. 보관 및 삭제</strong>
              <br />
              - 로컬 기기에 저장되며, 탈퇴 시 모두 삭제됩니다.
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => setShowPrivacy(false)}
              className="w-full h-12 rounded-xl bg-smart-primary hover:bg-smart-primary-dark text-white"
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terms Modal */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-[320px] rounded-[20px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">이용약관</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto text-sm text-smart-text-secondary space-y-3 mt-2">
            <p>SmartDose 이용약관</p>
            <p>
              <strong className="text-smart-text">제1조 (목적)</strong>
              <br />
              본 약관은 SmartDose 서비스 이용과 관련된 권리와 의무를 규정합니다.
            </p>
            <p>
              <strong className="text-smart-text">제2조 (서비스 내용)</strong>
              <br />
              - 어린이 해열제 용량 계산
              - 투약 기록 관리
              - 알림 서비스
            </p>
            <p>
              <strong className="text-smart-text">제3조 (면책)</strong>
              <br />
              본 앱의 계산 결과는 참고용이며, 의사의 처방을 대체할 수 없습니다.
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => setShowTerms(false)}
              className="w-full h-12 rounded-xl bg-smart-primary hover:bg-smart-primary-dark text-white"
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* App Info Modal */}
      <Dialog open={showAppInfo} onOpenChange={setShowAppInfo}>
        <DialogContent className="max-w-[320px] rounded-[20px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-center">앱 정보</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            <img src="/logo.svg" alt="SmartDose" className="w-16 h-16 mb-3" />
            <h4 className="text-base font-semibold text-smart-text">SmartDose</h4>
            <p className="text-sm text-smart-text-muted mt-1">어린이 해열제 투약 계산기</p>
            <div className="mt-4 space-y-1 text-sm text-smart-text-secondary text-center">
              <p>버전: 1.0.0</p>
              <p>SmartDose Team</p>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button
              onClick={() => setShowAppInfo(false)}
              className="w-full h-12 rounded-xl bg-smart-primary hover:bg-smart-primary-dark text-white"
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}
