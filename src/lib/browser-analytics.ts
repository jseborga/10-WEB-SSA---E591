'use client'

const VISITOR_SESSION_STORAGE_KEY = 'ssa_visitor_session_id'

export function getOrCreateVisitorSessionId() {
  if (typeof window === 'undefined') return ''

  const existing = window.localStorage.getItem(VISITOR_SESSION_STORAGE_KEY)
  if (existing) return existing

  const next =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  window.localStorage.setItem(VISITOR_SESSION_STORAGE_KEY, next)
  return next
}

export function sendAnalyticsEvent(input: {
  eventType: string
  path?: string | null
  durationMs?: number | null
  payload?: Record<string, unknown> | null
}) {
  if (typeof window === 'undefined') return

  const url = '/api/analytics/track'
  const sessionId = getOrCreateVisitorSessionId()
  const searchParams = new URLSearchParams(window.location.search)
  const body = {
    sessionId,
    eventType: input.eventType,
    path: input.path || window.location.pathname + window.location.search,
    referrer: document.referrer || '',
    durationMs: input.durationMs ?? undefined,
    payload: input.payload ?? undefined,
    utmSource: searchParams.get('utm_source'),
    utmMedium: searchParams.get('utm_medium'),
    utmCampaign: searchParams.get('utm_campaign'),
    utmContent: searchParams.get('utm_content'),
    utmTerm: searchParams.get('utm_term'),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language || '',
  }

  const json = JSON.stringify(body)

  if (navigator.sendBeacon) {
    const blob = new Blob([json], { type: 'application/json' })
    navigator.sendBeacon(url, blob)
    return
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json,
    keepalive: true,
  }).catch(() => {})
}
