import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { generateAutomationResponse } from '@/lib/automation-ai'
import {
  buildAnalyticsManagerPrompt,
  isFollowUpDue,
  summarizeContentForManager,
  summarizeCrmForManager,
  summarizeRecentAnalytics,
} from '@/lib/crm-routing'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const [config, siteSettings, sessions, leads, contacts, projects, publications, reviews] = await Promise.all([
      db.chatConfig.findFirst({ orderBy: { createdAt: 'asc' } }),
      db.siteSettings.findFirst({ orderBy: { createdAt: 'asc' } }),
      db.visitorSession.findMany({ orderBy: { updatedAt: 'desc' }, take: 120 }),
      db.leadCapture.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 }),
      db.contact.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
      db.project.findMany({ orderBy: { updatedAt: 'desc' } }),
      db.publication.findMany({ orderBy: { updatedAt: 'desc' } }),
      db.approvalItem.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    ])

    if (!config) {
      return NextResponse.json({ error: 'Configura primero la IA operativa en el panel.' }, { status: 400 })
    }

    const trafficSummary = summarizeRecentAnalytics(
      sessions.map((session) => ({
        landingPath: session.landingPath,
        referrer: session.referrer,
        countryHint: session.countryHint,
        utmSource: session.utmSource,
        utmCampaign: session.utmCampaign,
        durationSeconds: session.durationSeconds,
        pageViews: session.pageViews,
      })),
    )

    const crmSummary = summarizeCrmForManager({
      totalLeads: leads.length,
      openLeads: leads.filter((lead) => !['won', 'lost', 'archived'].includes(lead.leadStatus)).length,
      wonLeads: leads.filter((lead) => lead.leadStatus === 'won').length,
      dueToday: leads.filter((lead) => isFollowUpDue(lead.nextFollowUpAt) && !['won', 'lost', 'archived'].includes(lead.leadStatus)).length,
      needsHuman: leads.filter((lead) => lead.needsHuman).length,
      contacts: contacts.length,
    })

    const contentSummary = summarizeContentForManager({
      publishedProjects: projects.filter((project) => project.published).length,
      draftProjects: projects.filter((project) => !project.published).length,
      publishedPages: publications.filter((publication) => publication.published).length,
      pendingReviews: reviews.filter((review) => review.status === 'pending').length,
    })

    const prompt = buildAnalyticsManagerPrompt({
      siteName: siteSettings?.companyName || 'SSA Ingenieria',
      periodLabel: 'últimos registros disponibles',
      trafficSummary,
      crmSummary,
      contentSummary,
    })

    const generation = await generateAutomationResponse(config, prompt)

    return NextResponse.json({
      success: true,
      report: generation.output,
      provider: generation.provider,
      model: generation.model,
      context: {
        trafficSummary,
        crmSummary,
        contentSummary,
      },
    })
  } catch (error) {
    console.error('Error generating management report:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo generar el informe gerencial' },
      { status: 500 },
    )
  }
}
