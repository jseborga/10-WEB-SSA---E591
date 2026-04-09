import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { generateChatResponse } from '@/lib/chat-provider'
import { normalizeSeoKeywords } from '@/lib/publications'

type SiteSeoResponse = {
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string
}

function extractJsonBlock(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i)

  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')

  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1)
  }

  return raw.trim()
}

function normalizeSuggestion(data: unknown) {
  const source = typeof data === 'object' && data ? (data as Record<string, unknown>) : {}
  const read = (key: string) => (typeof source[key] === 'string' ? source[key]!.trim() : '')

  const result: SiteSeoResponse = {
    seoTitle: read('seoTitle'),
    seoDescription: read('seoDescription'),
    seoKeywords: normalizeSeoKeywords(read('seoKeywords')),
  }

  return result
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json().catch(() => ({}))
    const config = await db.chatConfig.findFirst({
      orderBy: { createdAt: 'asc' },
    })

    if (!config) {
      return NextResponse.json({ error: 'Primero configura un proveedor de IA en el panel.' }, { status: 400 })
    }

    const siteDraft = {
      companyName: typeof body.companyName === 'string' ? body.companyName.trim() : '',
      legalName: typeof body.legalName === 'string' ? body.legalName.trim() : '',
      tagline: typeof body.tagline === 'string' ? body.tagline.trim() : '',
      siteUrl: typeof body.siteUrl === 'string' ? body.siteUrl.trim() : '',
      email: typeof body.email === 'string' ? body.email.trim() : '',
      phone: typeof body.phone === 'string' ? body.phone.trim() : '',
      whatsapp: typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '',
      addressLine: typeof body.addressLine === 'string' ? body.addressLine.trim() : '',
      city: typeof body.city === 'string' ? body.city.trim() : '',
      country: typeof body.country === 'string' ? body.country.trim() : '',
      footerText: typeof body.footerText === 'string' ? body.footerText.trim() : '',
      projectCategories: typeof body.projectCategories === 'string' ? body.projectCategories.trim() : '',
      currentSeoTitle: typeof body.seoTitle === 'string' ? body.seoTitle.trim() : '',
      currentSeoDescription: typeof body.seoDescription === 'string' ? body.seoDescription.trim() : '',
      currentSeoKeywords: typeof body.seoKeywords === 'string' ? body.seoKeywords.trim() : '',
    }

    const prompt = [
      'Actua como estratega SEO para una empresa de ingenieria, arquitectura, construccion y software para el sector.',
      'Debes proponer campos SEO corporativos listos para Google y otros buscadores.',
      'Devuelve solo JSON valido, sin markdown, sin comentarios y sin texto adicional.',
      'Usa espanol neutro.',
      'No inventes premios, certificaciones ni ubicaciones no provistas.',
      '',
      'Formato JSON exacto:',
      '{',
      '  "seoTitle": "Titulo SEO corporativo",',
      '  "seoDescription": "Meta descripcion clara y comercial",',
      '  "seoKeywords": "keyword 1, keyword 2, keyword 3"',
      '}',
      '',
      'Datos actuales del sitio:',
      JSON.stringify(siteDraft, null, 2),
    ].join('\n')

    const raw = await generateChatResponse(
      {
        provider: config.provider,
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        model: config.model,
        systemPrompt: config.systemPrompt || 'Eres un asistente SEO para una empresa de ingenieria.',
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
      [],
      prompt,
    )

    const parsed = JSON.parse(extractJsonBlock(raw))
    const suggestion = normalizeSuggestion(parsed)

    return NextResponse.json({ success: true, suggestion, raw })
  } catch (error) {
    console.error('Error generating site SEO with AI:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo generar el SEO del sitio' },
      { status: 500 },
    )
  }
}
