import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { motion } from 'framer-motion'
import { ChevronLeft, Loader2 } from 'lucide-react'
import Layout from '@/components/Layout'
import { useAppContext } from '@/contexts/AppContext'
import { showToast } from '@/components/Toast'
import { buildOAuthStartUrl, getOAuthErrorMessage, type OAuthProvider } from '@/lib/oauth'

type Provider = OAuthProvider

const PROVIDER_CONFIG: Record<
  Provider,
  {
    name: string
    buttonText: string
    bg: string
    text: string
    border?: string
    shadow?: string
    icon: string
  }
> = {
  kakao: {
    name: '카카오',
    buttonText: '카카오로 시작하기',
    bg: '#FEE500',
    text: '#000000',
    icon: '/kakao-icon.svg',
  },
  naver: {
    name: '네이버',
    buttonText: '네이버로 시작하기',
    bg: '#03C75A',
    text: '#FFFFFF',
    icon: '/naver-icon.svg',
  },
  google: {
    name: 'Google',
    buttonText: 'Google로 시작하기',
    bg: '#FFFFFF',
    text: '#000000',
    border: '1px solid #E2E8F0',
    shadow: '0 1px 3px rgba(0,0,0,0.08)',
    icon: '/google-icon.svg',
  },
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAppContext()

  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null)

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/settings', { replace: true })
    }
  }, [isLoggedIn, navigate])

  const startOAuthLogin = (provider: Provider) => {
    const from = (location.state as { from?: string } | null)?.from

    try {
      setLoadingProvider(provider)
      window.location.assign(buildOAuthStartUrl(provider, from || '/settings'))
    } catch (error) {
      setLoadingProvider(null)
      showToast(getOAuthErrorMessage(error), 'error')
    }
  }

  const handleGuest = () => {
    showToast('로그인 없이 사용합니다', 'info')
    navigate('/')
  }

  return (
    <Layout showNav={false} showHeader={false}>
      {/* Header with back button */}
      <div
        className="sticky top-0 z-50 h-14 flex items-center px-5 bg-white/90 backdrop-blur-md"
        style={{ borderBottom: '1px solid #E2E8F0' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-semibold text-smart-text active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5" />
          로그인
        </button>
      </div>

      <div className="flex flex-col items-center px-5 pt-12 pb-8">
        {/* ─── Brand Area ─── */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
            delay: 0.1,
          }}
          className="flex flex-col items-center gap-4"
        >
          <img
            src="/logo.svg"
            alt="SmartDose"
            className="w-20 h-20"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(20,184,166,0.2))' }}
          />
          <motion.h1
            initial={{ translateY: 15, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
              delay: 0.2,
            }}
            className="text-[1.75rem] font-bold text-smart-text tracking-tight"
          >
            SmartDose
          </motion.h1>
          <motion.p
            initial={{ translateY: 15, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
              delay: 0.3,
            }}
            className="text-base text-smart-text-secondary"
          >
            어린이 해열제 계산기
          </motion.p>
        </motion.div>

        {/* ─── Welcome Text ─── */}
        <motion.p
          initial={{ translateY: 15, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
            delay: 0.35,
          }}
          className="mt-6 text-sm text-smart-text-muted text-center"
        >
          투약 기록을 동기화하고 여러 기기에서 사용하세요
        </motion.p>

        {/* ─── Social Login Buttons ─── */}
        <div className="w-full max-w-[430px] flex flex-col gap-3 mt-10">
          {(['kakao', 'naver', 'google'] as Provider[]).map((provider, i) => {
            const cfg = PROVIDER_CONFIG[provider]
            const isLoading = loadingProvider === provider
            const isDisabled = loadingProvider !== null

            return (
              <motion.button
                key={provider}
                initial={{ translateY: 20, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                transition={{
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                  delay: 0.4 + i * 0.1,
                }}
                onClick={() => startOAuthLogin(provider)}
                disabled={isDisabled}
                className="w-full h-[52px] rounded-xl flex items-center justify-center gap-3 text-base font-semibold active:scale-[0.97] transition-transform relative overflow-hidden"
                style={{
                  background: cfg.bg,
                  color: cfg.text,
                  border: cfg.border,
                  boxShadow: cfg.shadow,
                  opacity: isDisabled && !isLoading ? 0.6 : 1,
                  pointerEvents: isDisabled ? 'none' : 'auto',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="opacity-70">로그인 중...</span>
                  </>
                ) : (
                  <>
                    <img
                      src={cfg.icon}
                      alt={cfg.name}
                      className="w-6 h-6 shrink-0"
                    />
                    <span>{cfg.buttonText}</span>
                  </>
                )}
              </motion.button>
            )
          })}
        </div>

        {/* ─── Guest Mode Link ─── */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.3,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
            delay: 0.8,
          }}
          onClick={handleGuest}
          className="mt-6 text-sm text-smart-text-muted underline underline-offset-4 active:scale-95 transition-transform"
        >
          로그인 없이 사용하기
        </motion.button>

        {/* ─── Info Text ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.3,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
            delay: 0.9,
          }}
          className="mt-8 flex flex-col items-center gap-1 text-center"
        >
          <p className="text-xs text-smart-text-muted leading-relaxed">
            로그인하면 투약 기록을 여러 기기에서
            <br />
            동기화할 수 있어요
          </p>
          <p className="text-xs text-smart-text-muted leading-relaxed">
            개인정보는 안전하게 보관되며,
            <br />
            로그인 제공자만 인증에 사용해요
          </p>
        </motion.div>
      </div>

    </Layout>
  )
}
