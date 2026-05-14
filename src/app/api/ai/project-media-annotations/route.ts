import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { generateChatResponse } from '@/lib/chat-provider'
import { parseTagList } from '@/lib/public-site'

type MediaSuggestion = {
  url: string
  category?: string
  label?: string
  tags?: string
}

type MediaSuggestionResponse = {
  projectTags?: string
  suggestions: MediaSuggestion[]
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
  const projectTagsValue = source.projectTags
  const projectTags =
    typeof projectTagsValue === 'string'
      ? parseTagList(projectTagsValue).map((tag) => `#${tag}`).join(', ')
      : Array.isArray(projectTagsValue)
        ? parseTagList(projectTagsValue.join(', ')).map((tag) => `#${tag}`).join(', ')
        : ''

  const rawSuggestions = Array.isArray(source.suggestions) ? source.suggestions : []

  const suggestions = rawSuggestions
    .map<MediaSuggestion | null>((item) => {
      const record = typeof item === 'object' && item ? (item as Record<string, unknown>) : {}
      const url = typeof record.url === 'string' ? record.url.trim() : ''

      if (!url) {
        return null
      }

      const category = typeof record.category === 'string' ? record.category.trim() : ''
      const label = typeof record.label === 'string' ? record.label.trim() : ''
      const tagsValue = Array.isArray(record.tags)
        ? record.tags.filter((tag) => typeof tag === 'string').join(', ')
        : typeof record.tags === 'string'
          ? record.tags
          : ''

      return {
        url,
        category,
        label,
        tags: parseTagList(tagsValue).map((tag) => `#${tag}`).join(', '),
      }
    })
    .filter((item): item is MediaSuggestion => Boolean(item?.url))

  return {
    projectTags,
    suggestions,
  }
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

    const urls = Array.isArray(body.urls)
      ? body.urls.filter((item: unknown) => typeof item === 'string').map((item: string) => item.trim()).filter(Boolean)
      : []

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No se recibieron imagenes para clasificar.' }, { status: 400 })
    }

    const fields = {
      target: typeof body.target === 'string' ? body.target.trim() : 'desktop',
      title: typeof body.title === 'string' ? body.title.trim() : '',
      category: typeof body.category === 'string' ? body.category.trim() : '',
      description: typeof body.description === 'string' ? body.description.trim() : '',
      fullDescription: typeof body.fullDescription === 'string' ? body.fullDescription.trim() : '',
      location: typeof body.location === 'string' ? body.location.trim() : '',
      client: typeof body.client === 'string' ? body.client.trim() : '',
      projectTags: typeof body.projectTags === 'string' ? body.projectTags.trim() : '',
      urls,
      currentAnnotations: Array.isArray(body.currentAnnotations) ? body.currentAnnotations : [],
    }

    const prompt = [
      'Actua como editor de galeria para una web premium de construccion, arquitectura e ingenieria.',
      'Tu tarea es sugerir categoria, texto corto y hashtags utiles para cada imagen de un proyecto.',
      'Trabaja de forma conservadora: si el nombre del archivo o el contexto no permiten gran precision, usa categorias utiles pero genericas como construccion, arquitectura, instalaciones, supervision, detalle-tecnico, avance-de-obra o contexto.',
      'No inventes elementos tecnicos demasiado especificos si no se pueden sostener.',
      'Devuelve solo JSON valido, sin markdown y sin texto adicional.',
      '',
      'Formato JSON exacto:',
      '{',
      '  "projectTags": "#tag-1, #tag-2, #tag-3",',
      '  "suggestions": [',
      '    {',
      '      "url": "url exacta recibida",',
      '      "category": "categoria breve en minusculas",',
      '      "label": "texto corto visible para la foto",',
      '      "tags": "#tag-1, #tag-2"',
      '    }',
      '  ]',
      '}',
      '',
      'Contexto del proyecto:',
      JSON.stringify(fields, null, 2),
    ].join('\n')

    const raw = await generateChatResponse(
      {
        provider: config.provider,
        apiKey: config.apiKey,
        apiBaseUrl: config.apiBaseUrl,
        model: config.model,
        systemPrompt: config.systemPrompt || 'Eres un asistente editorial para clasificar imagenes de proyectos.',
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
      [],
      prompt,
    )

    const parsed = JSON.parse(extractJsonBlock(raw))
    const suggestion: MediaSuggestionResponse = normalizeSuggestion(parsed)

    return NextResponse.json({ success: true, suggestion, raw })
  } catch (error) {
    console.error('Error generating project media annotations with AI:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron completar las etiquetas con IA' },
      { status: 500 },
    )
  }
}
