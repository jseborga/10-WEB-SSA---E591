import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { generateChatResponse } from '@/lib/chat-provider'

type ProjectCopyResponse = {
  title?: string
  description?: string
  fullDescription?: string
  category?: string
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

  const toValue = (key: string) => (typeof source[key] === 'string' ? source[key]!.trim() : '')

  const result: ProjectCopyResponse = {
    title: toValue('title'),
    description: toValue('description'),
    fullDescription: toValue('fullDescription'),
    category: toValue('category'),
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
      description: typeof body.description === 'string' ? body.description.trim() : '',
      fullDescription: typeof body.fullDescription === 'string' ? body.fullDescription.trim() : '',
      category: typeof body.category === 'string' ? body.category.trim() : '',
      location: typeof body.location === 'string' ? body.location.trim() : '',
      year: typeof body.year === 'string' ? body.year.trim() : '',
      area: typeof body.area === 'string' ? body.area.trim() : '',
      client: typeof body.client === 'string' ? body.client.trim() : '',
      referenceUrl: typeof body.referenceUrl === 'string' ? body.referenceUrl.trim() : '',
      hasDesktopImage: Boolean(body.hasDesktopImage),
      hasMobileImage: Boolean(body.hasMobileImage),
      galleryCount: typeof body.galleryCount === 'number' ? body.galleryCount : 0,
      galleryMobileCount: typeof body.galleryMobileCount === 'number' ? body.galleryMobileCount : 0,
      hasVideo: Boolean(body.hasVideo),
      status: typeof body.status === 'string' ? body.status.trim() : '',
    }

    const prompt = [
      'Actua como editor experto en arquitectura, construccion e ingenieria.',
      'Debes mejorar el texto de un proyecto para una web corporativa premium.',
      'Devuelve solo JSON valido, sin markdown, sin comentarios y sin texto adicional.',
      'Usa español neutro, tono profesional, concreto y elegante.',
      'No inventes datos tecnicos no provistos.',
      'Si falta informacion, mejora lo existente sin rellenar detalles falsos.',
      'Si el material visual parece escaso, refuerza el texto sin prometer elementos no entregados.',
      '',
      'Formato JSON exacto:',
      '{',
      '  "title": "Titulo mejorado",',
      '  "description": "Descripcion corta de 1 o 2 frases",',
      '  "fullDescription": "Descripcion amplia de 1 a 3 parrafos cortos",',
      '  "category": "categoria recomendada en minusculas"',
      '}',
      '',
      'Datos actuales del proyecto:',
      JSON.stringify(fields, null, 2),
    ].join('\n')

    const raw = await generateChatResponse(
      {
        provider: config.provider,
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        model: config.model,
        systemPrompt: config.systemPrompt || 'Eres un asistente editorial para proyectos de ingenieria y arquitectura.',
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
    console.error('Error generating project copy with AI:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo generar el texto con IA' },
      { status: 500 },
    )
  }
}
