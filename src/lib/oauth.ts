import type { UserProfile } from '@/contexts/AppContext'

export type OAuthProvider = 'kakao' | 'naver' | 'google'

const AUTH_STATE_PREFIX = 'smartdose_oauth_state:'
const STATE_TTL_MS = 10 * 60 * 1000

interface OAuthProviderConfig {
  authorizeUrl: string
  clientIdEnv: string
  redirectUriEnv: string
  scopeEnv: string
  defaultScope?: string
  extraParams?: Record<string, string>
}

interface StoredOAuthState {
  provider: OAuthProvider
  returnTo: string
  nonce: string
  createdAt: number
}

export interface OAuthCallbackResult {
  profile: UserProfile
  returnTo: string
}

interface ExchangeResponse {
  providerUserId?: string
  provider_user_id?: string
  id?: string
  sub?: string
  name?: string
  email?: string
  avatarUrl?: string
  avatar_url?: string
  accessToken?: string
  access_token?: string
  expiresAt?: string
  expires_at?: string
  expiresIn?: number
  expires_in?: number
}

const PROVIDER_CONFIG: Record<OAuthProvider, OAuthProviderConfig> = {
  kakao: {
    authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
    clientIdEnv: 'VITE_KAKAO_CLIENT_ID',
    redirectUriEnv: 'VITE_KAKAO_REDIRECT_URI',
    scopeEnv: 'VITE_KAKAO_SCOPE',
  },
  naver: {
    authorizeUrl: 'https://nid.naver.com/oauth2.0/authorize',
    clientIdEnv: 'VITE_NAVER_CLIENT_ID',
    redirectUriEnv: 'VITE_NAVER_REDIRECT_URI',
    scopeEnv: 'VITE_NAVER_SCOPE',
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientIdEnv: 'VITE_GOOGLE_CLIENT_ID',
    redirectUriEnv: 'VITE_GOOGLE_REDIRECT_URI',
    scopeEnv: 'VITE_GOOGLE_SCOPE',
    defaultScope: 'openid email profile',
    extraParams: {
      access_type: 'online',
      prompt: 'select_account',
    },
  },
}

function getEnv(key: string): string | undefined {
  const value = import.meta.env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function getRedirectUri(provider: OAuthProvider): string {
  return getEnv(PROVIDER_CONFIG[provider].redirectUriEnv) ?? `${window.location.origin}/auth/callback/${provider}`
}

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function createState(provider: OAuthProvider, returnTo: string): string {
  const nonce = generateNonce()
  const state: StoredOAuthState = {
    provider,
    returnTo,
    nonce,
    createdAt: Date.now(),
  }
  const encoded = btoa(JSON.stringify(state))
  sessionStorage.setItem(`${AUTH_STATE_PREFIX}${encoded}`, JSON.stringify(state))
  return encoded
}

function readAndClearState(value: string | null): StoredOAuthState {
  if (!value) throw new Error('missing_state')

  const key = `${AUTH_STATE_PREFIX}${value}`
  const raw = sessionStorage.getItem(key)
  sessionStorage.removeItem(key)

  if (!raw) throw new Error('invalid_state')

  const state = JSON.parse(raw) as StoredOAuthState
  if (Date.now() - state.createdAt > STATE_TTL_MS) throw new Error('expired_state')
  return state
}

function getCallbackParams(url: string): URLSearchParams {
  const parsed = new URL(url)
  const params = new URLSearchParams(parsed.search)
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
  const hashParams = new URLSearchParams(hash)

  hashParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value)
  })

  return params
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

function shouldStoreAccessToken(): boolean {
  return getEnv('VITE_STORE_OAUTH_ACCESS_TOKEN') === 'true'
}

function expiresAtFromParams(params: URLSearchParams): string | undefined {
  const expiresAt = params.get('expires_at')
  if (expiresAt) return expiresAt

  const expiresIn = Number(params.get('expires_in'))
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    return new Date(Date.now() + expiresIn * 1000).toISOString()
  }

  return undefined
}

function normalizeProfile(
  provider: OAuthProvider,
  source: ExchangeResponse,
  fallback?: URLSearchParams,
): UserProfile {
  const accessToken = source.accessToken ?? source.access_token ?? fallback?.get('access_token') ?? undefined
  const idToken = fallback?.get('id_token')
  const jwtPayload = idToken ? decodeJwtPayload(idToken) : null
  const jwtSub = typeof jwtPayload?.sub === 'string' ? jwtPayload.sub : undefined
  const jwtName = typeof jwtPayload?.name === 'string' ? jwtPayload.name : undefined
  const jwtEmail = typeof jwtPayload?.email === 'string' ? jwtPayload.email : undefined
  const providerUserId = source.providerUserId ?? source.provider_user_id ?? source.id ?? source.sub ?? jwtSub

  if (!providerUserId) throw new Error('missing_provider_user_id')

  const expiresIn = source.expiresIn ?? source.expires_in
  const tokenExpiresAt =
    source.expiresAt ??
    source.expires_at ??
    fallback?.get('expires_at') ??
    (typeof expiresIn === 'number' ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined) ??
    (fallback ? expiresAtFromParams(fallback) : undefined)
  const storedAccessToken = shouldStoreAccessToken() ? accessToken : undefined

  return {
    provider,
    providerUserId,
    name: source.name ?? fallback?.get('name') ?? jwtName ?? 'SmartDose 사용자',
    email: source.email ?? fallback?.get('email') ?? jwtEmail ?? undefined,
    avatarUrl: source.avatarUrl ?? source.avatar_url ?? fallback?.get('avatar_url') ?? undefined,
    accessTokenStored: Boolean(storedAccessToken),
    accessToken: storedAccessToken,
    tokenExpiresAt,
    authenticatedAt: new Date().toISOString(),
  }
}

async function exchangeAuthorizationCode(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
): Promise<ExchangeResponse> {
  const exchangeUrl = getEnv('VITE_OAUTH_EXCHANGE_URL')
  if (!exchangeUrl) throw new Error('missing_exchange_endpoint')

  const response = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, code, redirectUri }),
  })

  if (!response.ok) throw new Error('exchange_failed')
  return (await response.json()) as ExchangeResponse
}

export function buildOAuthStartUrl(provider: OAuthProvider, returnTo = '/settings'): string {
  const config = PROVIDER_CONFIG[provider]
  const clientId = getEnv(config.clientIdEnv)
  if (!clientId) throw new Error('missing_client_id')

  const redirectUri = getRedirectUri(provider)
  const state = createState(provider, returnTo)
  const url = new URL(config.authorizeUrl)
  const params: Record<string, string> = {
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  }
  const scope = getEnv(config.scopeEnv) ?? config.defaultScope

  if (scope) params.scope = scope
  Object.entries({ ...params, ...config.extraParams }).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return url.toString()
}

export function getOAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (['access_denied', 'user_cancel', 'consent_required'].includes(message)) {
    return '로그인이 취소되었습니다.'
  }
  if (['missing_client_id', 'missing_exchange_endpoint'].includes(message)) {
    return '로그인 설정이 완료되지 않았습니다.'
  }
  if (['missing_state', 'invalid_state', 'expired_state'].includes(message)) {
    return '로그인 요청이 만료되었습니다. 다시 시도해주세요.'
  }
  if (message === 'exchange_failed') {
    return '인증 서버에서 로그인 정보를 가져오지 못했습니다.'
  }

  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
}

export async function completeOAuthCallback(
  provider: OAuthProvider,
  callbackUrl = window.location.href,
): Promise<OAuthCallbackResult> {
  const params = getCallbackParams(callbackUrl)
  const state = readAndClearState(params.get('state'))

  if (state.provider !== provider) throw new Error('invalid_state')

  const error = params.get('error') ?? params.get('error_description')
  if (error) throw new Error(error)

  const code = params.get('code')
  const accessToken = params.get('access_token')
  const hasRedirectedProfile = params.has('provider_user_id') || params.has('providerUserId') || params.has('id')

  if (hasRedirectedProfile || accessToken) {
    return {
      profile: normalizeProfile(provider, {
        providerUserId: params.get('providerUserId') ?? params.get('provider_user_id') ?? undefined,
        id: params.get('id') ?? undefined,
        name: params.get('name') ?? undefined,
        email: params.get('email') ?? undefined,
      }, params),
      returnTo: state.returnTo,
    }
  }

  if (!code) throw new Error('missing_authorization_code')

  const exchanged = await exchangeAuthorizationCode(provider, code, getRedirectUri(provider))
  return {
    profile: normalizeProfile(provider, exchanged),
    returnTo: state.returnTo,
  }
}
