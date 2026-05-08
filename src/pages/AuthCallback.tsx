import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import Layout from '@/components/Layout'
import { showToast } from '@/components/Toast'
import { useAppContext } from '@/contexts/AppContext'
import { completeOAuthCallback, getOAuthErrorMessage, type OAuthProvider } from '@/lib/oauth'

const PROVIDER_NAMES: Record<OAuthProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
}

function isOAuthProvider(value: string | undefined): value is OAuthProvider {
  return value === 'kakao' || value === 'naver' || value === 'google'
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const params = useParams()
  const { login } = useAppContext()
  const hasCompleted = useRef(false)
  const provider = params.provider

  useEffect(() => {
    if (hasCompleted.current) return
    hasCompleted.current = true

    if (!isOAuthProvider(provider)) {
      showToast('지원하지 않는 로그인 제공자입니다.', 'error')
      navigate('/login', { replace: true })
      return
    }

    completeOAuthCallback(provider)
      .then(({ profile, returnTo }) => {
        login(profile)
        showToast('로그인되었습니다.', 'success')
        navigate(returnTo || '/settings', { replace: true })
      })
      .catch((error) => {
        showToast(getOAuthErrorMessage(error), 'error')
        navigate('/login', { replace: true })
      })
  }, [login, navigate, provider])

  return (
    <Layout showNav={false} showHeader={false}>
      <div className="min-h-screen flex items-center justify-center px-6 bg-smart-bg">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="w-full max-w-[320px] rounded-[20px] bg-white shadow-card p-8 flex flex-col items-center gap-4 text-center"
        >
          <Loader2 className="w-9 h-9 text-smart-primary animate-spin" />
          <h1 className="text-lg font-semibold text-smart-text">
            {isOAuthProvider(provider) ? `${PROVIDER_NAMES[provider]} 로그인 처리 중` : '로그인 처리 중'}
          </h1>
          <p className="text-sm leading-relaxed text-smart-text-secondary">
            인증 결과를 확인하고 있습니다.
            <br />
            잠시만 기다려주세요.
          </p>
        </motion.div>
      </div>
    </Layout>
  )
}
