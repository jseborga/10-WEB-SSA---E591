import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

function topEntries(values: string[], limit = 6) {
  const map = new Map<string, number>()

  for (const value of values) {
    const normalized = value.trim()
    if (!normalized) continue
    map.set(normalized, (map.get(normalized) || 0) + 1)
  }

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }))
}

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const [sessions, events] = await Promise.all([
      db.visitorSession.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 400,
      }),
      db.visitorEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
    ])

    const pageViewEvents = events.filter((event) => event.eventType === 'page-view')
    const engagementEvents = events.filter((event) => event.eventType === 'page-engagement')
    const totalDurationSeconds = sessions.reduce((sum, session) => sum + (session.durationSeconds || 0), 0)
    const totalPageViews = sessions.reduce((sum, session) => sum + (session.pageViews || 0), 0)

    const response = {
      overview: {
        totalSessions: sessions.length,
        totalPageViews,
        averageDurationSeconds: sessions.length ? Math.round(totalDurationSeconds / sessions.length) : 0,
        averagePageViews: sessions.length ? Number((totalPageViews / sessions.length).toFixed(1)) : 0,
        uniqueReferrers: new Set(sessions.map((session) => session.referrer || 'directo')).size,
        eventsTracked: events.length,
      },
      topPages: topEntries(pageViewEvents.map((event) => event.path || '/')),
      topReferrers: topEntries(sessions.map((session) => session.referrer || 'directo')),
      topCountries: topEntries(sessions.map((session) => session.countryHint || 'sin-pais')),
      topCampaigns: topEntries(
        sessions.map(
          (session) => session.utmCampaign || session.utmSource || session.utmMedium || 'organico/directo',
        ),
      ),
      recentVisitors: sessions.slice(0, 20).map((session) => ({
        id: session.id,
        sessionId: session.sessionId,
        landingPath: session.landingPath || '/',
        currentPath: session.currentPath || session.landingPath || '/',
        ipAddress: session.ipAddress || 'sin-ip',
        location: [session.cityHint, session.countryHint].filter(Boolean).join(', ') || 'sin-ubicacion',
        referrer: session.referrer || 'directo',
        pageViews: session.pageViews,
        durationSeconds: session.durationSeconds,
        lastSeenAt: session.updatedAt,
        campaign: session.utmCampaign || session.utmSource || null,
        entryDevice: session.entryDevice || 'unknown',
      })),
      recentEvents: events.slice(0, 30).map((event) => ({
        id: event.id,
        eventType: event.eventType,
        path: event.path || '/',
        referrer: event.referrer || 'directo',
        ipAddress: event.ipAddress || 'sin-ip',
        durationMs: event.durationMs,
        createdAt: event.createdAt,
      })),
      eventBreakdown: topEntries(events.map((event) => event.eventType), 10),
      engagementSummary: {
        engagementEvents: engagementEvents.length,
        pageViewEvents: pageViewEvents.length,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching site analytics:', error)
    return NextResponse.json({ error: 'No se pudo cargar la analitica del sitio' }, { status: 500 })
  }
}
