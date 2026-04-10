'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getOrCreateVisitorSessionId, sendAnalyticsEvent } from '@/lib/browser-analytics'

export function SiteAnalyticsTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pageStartedAt = useRef<number>(Date.now())
  const lastTrackedPath = useRef<string>('')

  useEffect(() => {
    getOrCreateVisitorSessionId()
  }, [])

  useEffect(() => {
    const fullPath = `${pathname || '/'}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`
    if (fullPath.startsWith('/admin')) {
      return
    }
    const previousPath = lastTrackedPath.current
    const now = Date.now()

    if (previousPath && previousPath !== fullPath) {
      sendAnalyticsEvent({
        eventType: 'page-engagement',
        path: previousPath,
        durationMs: now - pageStartedAt.current,
      })
    }

    pageStartedAt.current = now
    lastTrackedPath.current = fullPath

    sendAnalyticsEvent({
      eventType: 'page-view',
      path: fullPath,
    })
  }, [pathname, searchParams])

  useEffect(() => {
    const flushEngagement = () => {
      if (!lastTrackedPath.current) return

      sendAnalyticsEvent({
        eventType: 'page-engagement',
        path: lastTrackedPath.current,
        durationMs: Date.now() - pageStartedAt.current,
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushEngagement()
      }
    }

    window.addEventListener('pagehide', flushEngagement)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', flushEngagement)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return null
}
