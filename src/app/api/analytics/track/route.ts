import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  extractCityHint,
  extractClientIp,
  extractCountryHint,
  extractDeviceFromUserAgent,
  extractLanguage,
  normalizeAnalyticsPayload,
  safeNumber,
  type AnalyticsTrackInput,
} from '@/lib/site-analytics'

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as AnalyticsTrackInput
    const sessionId = normalizeText(body.sessionId)
    const eventType = normalizeText(body.eventType) || 'page-view'
    const path = normalizeText(body.path) || '/'
    const referrer = normalizeText(body.referrer)
    const userAgent = request.headers.get('user-agent')?.trim() || null
    const ipAddress = extractClientIp(request.headers)
    const countryHint = extractCountryHint(request.headers)
    const cityHint = extractCityHint(request.headers)
    const language = extractLanguage(request.headers, body.language)
    const durationMs = Math.max(0, Math.round(safeNumber(body.durationMs, 0)))
    const durationSeconds = Math.round(durationMs / 1000)

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const incrementPageView = eventType === 'page-view' ? 1 : 0

    await db.visitorSession.upsert({
      where: { sessionId },
      create: {
        sessionId,
        landingPath: path,
        currentPath: path,
        referrer: referrer || null,
        ipAddress,
        countryHint,
        cityHint,
        userAgent,
        language,
        utmSource: normalizeText(body.utmSource) || null,
        utmMedium: normalizeText(body.utmMedium) || null,
        utmCampaign: normalizeText(body.utmCampaign) || null,
        utmContent: normalizeText(body.utmContent) || null,
        utmTerm: normalizeText(body.utmTerm) || null,
        viewport: normalizeText(body.viewport) || null,
        entryDevice: extractDeviceFromUserAgent(userAgent),
        pageViews: incrementPageView,
        eventCount: 1,
        durationSeconds,
        lastEventAt: new Date(),
      },
      update: {
        currentPath: path,
        referrer: referrer || undefined,
        ipAddress: ipAddress || undefined,
        countryHint: countryHint || undefined,
        cityHint: cityHint || undefined,
        userAgent: userAgent || undefined,
        language: language || undefined,
        utmSource: normalizeText(body.utmSource) || undefined,
        utmMedium: normalizeText(body.utmMedium) || undefined,
        utmCampaign: normalizeText(body.utmCampaign) || undefined,
        utmContent: normalizeText(body.utmContent) || undefined,
        utmTerm: normalizeText(body.utmTerm) || undefined,
        viewport: normalizeText(body.viewport) || undefined,
        entryDevice: extractDeviceFromUserAgent(userAgent),
        pageViews: { increment: incrementPageView },
        eventCount: { increment: 1 },
        durationSeconds: { increment: durationSeconds },
        lastEventAt: new Date(),
      },
    })

    await db.visitorEvent.create({
      data: {
        sessionId,
        eventType,
        path,
        referrer: referrer || null,
        ipAddress,
        durationMs: durationMs > 0 ? durationMs : null,
        payload: normalizeAnalyticsPayload(body.payload),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking analytics event:', error)
    return NextResponse.json({ error: 'Could not track event' }, { status: 500 })
  }
}
