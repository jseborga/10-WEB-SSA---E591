import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { generateChatResponse } from '@/lib/chat-provider'
import { normalizeSeoKeywords, slugifyPublicationValue } from '@/lib/publications'

type PublicationCopyResponse = {
  title?: string
  slug?: string
  excerpt?: string
  content?: string
  category?: string
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

  const title = read('title')

  const result: PublicationCopyResponse = {
    title,
    slug: slugifyPublicationValue(read('slug') || title),
    excerpt: read('excerpt'),
    content: read('content'),
    category: read('category'),
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

    const fields = {
      title: typeof body.title === 'string' ? body.title.trim() : '',
      slug: typeof body.slug === 'string' ? body.slug.trim() : '',
      excerpt: typeof body.excerpt === 'string' ? body.excerpt.trim() : '',
      content: typeof body.content === 'string' ? body.content.trim() : '',
      category: typeof body.category === 'string' ? body.category.trim() : '',
      seoTitle: typeof body.seoTitle === 'string' ? body.seoTitle.trim() : '',
      seoDescription: typeof body.seoDescription === 'string' ? body.seoDescription.trim() : '',
      seoKeywords: typeof body.seoKeywords === 'string' ? body.seoKeywords.trim() : '',
      showInMenu: Boolean(body.showInMenu),
    }

    const prompt = [
      'Actua como editor web y estratega SEO para una empresa premium de ingenieria, arquitectura y construccion.',
      'Debes mejorar una pagina informativa o comercial para web corporativa.',
      'Devuelve solo JSON valido, sin markdown, sin comentarios y sin texto adicional.',
      'Usa espanol neutro, tono profesional, claro y elegante.',
      'No inventes certificaciones, datos tecnicos ni afirmaciones no provistas.',
      '',
      'Formato JSON exacto:',
      '{',
      '  "title": "Titulo optimizado",',
      '  "slug": "slug-sugerido",',
      '  "excerpt": "Resumen breve de 1 o 2 frases",',
      '  "content": "Contenido mejorado en 2 a 5 parrafos cortos",',
      '  "category": "categoria recomendada",',
      '  "seoTitle": "Titulo SEO de hasta 60 caracteres si es posible",',
      '  "seoDescription": "Meta descripcion de hasta 155 caracteres si es posible",',
      '  "seoKeywords": "palabra clave 1, palabra clave 2, palabra clave 3"',
      '}',
      '',
      'Datos actuales de la pagina:',
      JSON.stringify(fields, null, 2),
    ].join('\n')

    const raw = await generateChatResponse(
      {
        provider: config.provider,
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        model: config.model,
        systemPrompt: config.systemPrompt || 'Eres un asistente editorial y SEO para una empresa de ingenieria.',
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
    console.error('Error generating publication copy with AI:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo generar la sugerencia de la pagina' },
      { status: 500 },
    )
  }
}
