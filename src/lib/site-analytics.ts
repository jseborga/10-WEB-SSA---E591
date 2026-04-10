export type AnalyticsTrackInput = {
  sessionId: string
  eventType: string
  path?: string | null
  referrer?: string | null
  durationMs?: number | null
  payload?: Record<string, unknown> | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  viewport?: string | null
  language?: string | null
}

function firstHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name)
    if (value?.trim()) {
      return value.trim()
    }
  }

  return ''
}

export function extractClientIp(headers: Headers) {
  const forwarded = firstHeader(headers, ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'])
  if (!forwarded) return null

  return forwarded.split(',')[0]?.trim() || null
}

export function extractCountryHint(headers: Headers) {
  return (
    firstHeader(headers, ['cf-ipcountry', 'x-vercel-ip-country', 'x-country-code']) ||
    null
  )
}

export function extractCityHint(headers: Headers) {
  return (
    firstHeader(headers, ['x-vercel-ip-city', 'x-city', 'cf-ipcity']) ||
    null
  )
}

export function extractLanguage(headers: Headers, fallback?: string | null) {
  const preferred = fallback?.trim()
  if (preferred) return preferred

  const acceptLanguage = firstHeader(headers, ['accept-language'])
  if (!acceptLanguage) return null
  return acceptLanguage.split(',')[0]?.trim() || null
}

export function extractDeviceFromUserAgent(userAgent: string | null | undefined) {
  const normalized = (userAgent || '').toLowerCase()

  if (!normalized) return 'unknown'
  if (/mobile|iphone|android(?!.*tablet)/.test(normalized)) return 'mobile'
  if (/ipad|tablet/.test(normalized)) return 'tablet'
  return 'desktop'
}

export function normalizeAnalyticsPayload(payload: Record<string, unknown> | null | undefined) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  try {
    return JSON.stringify(payload)
  } catch {
    return null
  }
}

export function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}
