import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { buildProjectsContext, generateSalesPromptWithAi } from '@/lib/chat-sales'

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json().catch(() => ({}))
    const language = body.language === 'en' || body.language === 'pt' ? body.language : 'es'
    const draftConfig = body.draftConfig && typeof body.draftConfig === 'object' ? body.draftConfig as Record<string, unknown> : null

    const config = await db.chatConfig.findFirst({
      orderBy: { createdAt: 'asc' },
    })

    if (!config && !draftConfig) {
      return NextResponse.json({ error: 'Primero configura el proveedor IA del chat.' }, { status: 400 })
    }

    const siteSettings = await db.siteSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    })
    const publishedProjects = await db.project.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        title: true,
        category: true,
        location: true,
        description: true,
      },
    })

    const resolvedCompanyInfo =
      language === 'en'
        ? (typeof draftConfig?.companyInfoEn === 'string' ? draftConfig.companyInfoEn : config?.companyInfoEn) || (typeof draftConfig?.companyInfo === 'string' ? draftConfig.companyInfo : config?.companyInfo) || ''
        : language === 'pt'
          ? (typeof draftConfig?.companyInfoPt === 'string' ? draftConfig.companyInfoPt : config?.companyInfoPt) || (typeof draftConfig?.companyInfo === 'string' ? draftConfig.companyInfo : config?.companyInfo) || ''
          : (typeof draftConfig?.companyInfo === 'string' ? draftConfig.companyInfo : config?.companyInfo) || ''

    const resolvedSystemPrompt =
      language === 'en'
        ? (typeof draftConfig?.systemPromptEn === 'string' ? draftConfig.systemPromptEn : config?.systemPromptEn) || (typeof draftConfig?.systemPrompt === 'string' ? draftConfig.systemPrompt : config?.systemPrompt) || ''
        : language === 'pt'
          ? (typeof draftConfig?.systemPromptPt === 'string' ? draftConfig.systemPromptPt : config?.systemPromptPt) || (typeof draftConfig?.systemPrompt === 'string' ? draftConfig.systemPrompt : config?.systemPrompt) || ''
          : (typeof draftConfig?.systemPrompt === 'string' ? draftConfig.systemPrompt : config?.systemPrompt) || ''

    const resolvedProvider = typeof draftConfig?.provider === 'string' ? draftConfig.provider : config?.provider
    const resolvedApiKey = typeof draftConfig?.apiKey === 'string' ? draftConfig.apiKey : config?.apiKey
    const resolvedApiBaseUrl = typeof draftConfig?.apiBaseUrl === 'string' ? draftConfig.apiBaseUrl : config?.apiBaseUrl
    const resolvedModel = typeof draftConfig?.model === 'string' ? draftConfig.model : config?.model
    const resolvedTemperature = typeof draftConfig?.temperature === 'number' ? draftConfig.temperature : config?.temperature
    const resolvedMaxTokens = typeof draftConfig?.maxTokens === 'number' ? draftConfig.maxTokens : config?.maxTokens

    if (!resolvedProvider || !resolvedSystemPrompt) {
      return NextResponse.json({ error: 'Falta completar la configuracion IA del panel antes de generar el prompt.' }, { status: 400 })
    }

    const suggestion = await generateSalesPromptWithAi({
      config: {
        provider: resolvedProvider,
        apiKey: resolvedApiKey,
        apiBaseUrl: resolvedApiBaseUrl,
        model: resolvedModel,
        systemPrompt: resolvedSystemPrompt,
        temperature: typeof resolvedTemperature === 'number' ? resolvedTemperature : 0.7,
        maxTokens: typeof resolvedMaxTokens === 'number' ? resolvedMaxTokens : 1000,
      },
      language,
      companyName:
        (typeof draftConfig?.companyName === 'string' && draftConfig.companyName.trim()) ||
        siteSettings?.companyName ||
        config?.companyName ||
        'SSA Ingenieria',
      companyInfo: resolvedCompanyInfo,
      contactEmail: siteSettings?.email || null,
      contactPhone: siteSettings?.phone || null,
      whatsapp: siteSettings?.whatsapp || null,
      address: [siteSettings?.addressLine, siteSettings?.city, siteSettings?.country].filter(Boolean).join(', '),
      projectsContext: [buildProjectsContext(publishedProjects), siteSettings?.projectCategories ? `Categorias base: ${siteSettings.projectCategories}` : null]
        .filter(Boolean)
        .join('\n'),
    })

    return NextResponse.json({ success: true, suggestion })
  } catch (error) {
    console.error('Error generating sales prompt:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo generar el prompt comercial' },
      { status: 500 },
    )
  }
}
