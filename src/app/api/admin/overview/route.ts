import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Resumen para la pantalla de inicio del panel. */
export async function GET(request: Request) {
  const unauthorized = await requireAuthenticatedUser(request)

  if (unauthorized) {
    return unauthorized
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [publications, drafts, fromSocial, projects, media, newLeads, unreadContacts, visitsWeek, recentPublications, chatConfig, social] =
    await Promise.all([
      db.publication.count(),
      db.publication.count({ where: { published: false } }),
      db.publication.count({ where: { source: { in: ['instagram', 'facebook'] } } }),
      db.project.count(),
      db.mediaAsset.count(),
      db.leadCapture.count({ where: { leadStatus: 'new' } }),
      db.contact.count({ where: { isRead: false } }),
      db.visitorSession.count({ where: { createdAt: { gte: weekAgo } } }),
      db.publication.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, published: true, source: true, image: true, updatedAt: true },
      }),
      db.chatConfig.findFirst({ select: { imageApiKey: true, automationApiKey: true, apiKey: true, provider: true } }),
      db.socialConnection.findUnique({ where: { provider: 'meta' }, select: { pageName: true, igUsername: true, lastSyncAt: true } }),
    ])

  const geminiConfigured = Boolean(
    chatConfig?.imageApiKey ||
      chatConfig?.automationApiKey ||
      (chatConfig?.apiKey && ['google', 'gemini', 'default'].includes(chatConfig.provider)) ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY,
  )

  return NextResponse.json({
    counts: { publications, drafts, fromSocial, projects, media, newLeads, unreadContacts, visitsWeek },
    recentPublications,
    integrations: {
      gemini: geminiConfigured,
      meta: social ? { pageName: social.pageName, igUsername: social.igUsername, lastSyncAt: social.lastSyncAt } : null,
    },
  })
}
