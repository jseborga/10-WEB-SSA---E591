import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { generateAutomationResponse } from '@/lib/automation-ai'
import { buildProjectsContext } from '@/lib/chat-sales'
import { db } from '@/lib/db'

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

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeChoice(value: string, options: readonly string[], fallback: string) {
  return options.includes(value) ? value : fallback
}

function buildLeadContext(
  lead: Awaited<ReturnType<typeof db.leadCapture.findUnique>>,
  messages: Array<{ name: string; message: string; isFromAdmin: boolean; isFromAI: boolean; createdAt: Date }>,
) {
  return [
    `Lead ${lead?.id || ''}`,
    `Nombre: ${lead?.name || 'Sin definir'}`,
    `Correo: ${lead?.email || 'Sin definir'}`,
    `Telefono: ${lead?.phone || 'Sin definir'}`,
    `Telegram: ${lead?.telegramHandle || 'Sin definir'}`,
    `Canal preferido: ${lead?.preferredContactChannel || 'Sin definir'}`,
    `Servicio: ${lead?.serviceType || 'Sin definir'}`,
    `Tipo de proyecto: ${lead?.projectType || 'Sin definir'}`,
    `Ubicacion: ${lead?.projectLocation || 'Sin definir'}`,
    `Idea del proyecto: ${lead?.projectIdea || 'Sin definir'}`,
    `Estado CRM: ${lead?.leadStatus || 'new'}`,
    `Prioridad: ${lead?.priority || 'normal'}`,
    `Resumen actual: ${lead?.summary || 'Sin resumen'}`,
    `Ultimo mensaje visitante: ${lead?.lastVisitorMessage || 'Sin dato'}`,
    `Notas internas: ${lead?.internalNotes || 'Sin notas'}`,
    '',
    'Conversacion reciente:',
    messages.length
      ? messages
          .map((message) => {
            const sender = message.isFromAdmin ? 'Admin' : message.isFromAI ? 'IA' : message.name || 'Visitante'
            return `- ${sender}: ${message.message}`
          })
          .join('\n')
      : 'Sin historial disponible.',
  ].join('\n')
}

function buildContactContext(contact: Awaited<ReturnType<typeof db.contact.findUnique>>) {
  return [
    `Contacto ${contact?.id || ''}`,
    `Nombre: ${contact?.name || 'Sin definir'}`,
    `Correo: ${contact?.email || 'Sin definir'}`,
    `Telefono: ${contact?.phone || 'Sin definir'}`,
    `Asunto: ${contact?.subject || 'Sin asunto'}`,
    `Mensaje: ${contact?.message || 'Sin mensaje'}`,
    `Estado CRM: ${contact?.status || 'new'}`,
    `Prioridad: ${contact?.priority || 'normal'}`,
    `Responsable: ${contact?.ownerName || 'Sin asignar'}`,
    `Proxima accion: ${contact?.nextAction || 'Sin definir'}`,
    `Resumen actual: ${contact?.aiSummary || 'Sin resumen'}`,
    `Notas internas: ${contact?.internalNotes || 'Sin notas'}`,
  ].join('\n')
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json().catch(() => ({}))
    const target = body.target === 'contact' ? 'contact' : 'lead'
    const id = normalizeText(body.id)

    if (!id) {
      return NextResponse.json({ error: 'Falta el identificador del caso.' }, { status: 400 })
    }

    const [config, projects] = await Promise.all([
      db.chatConfig.findFirst({ orderBy: { createdAt: 'asc' } }),
      db.project.findMany({
        where: { published: true },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          title: true,
          category: true,
          location: true,
          description: true,
        },
      }),
    ])

    if (!config) {
      return NextResponse.json({ error: 'Configura primero la IA en el panel.' }, { status: 400 })
    }

    const projectsContext = buildProjectsContext(projects)
    let context = ''
    let persisted: Record<string, unknown> | null = null

    if (target === 'lead') {
      const lead = await db.leadCapture.findUnique({ where: { id } })

      if (!lead) {
        return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 })
      }

      const messages = await db.chatMessage.findMany({
        where: { sessionId: lead.sessionId },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: {
          name: true,
          message: true,
          isFromAdmin: true,
          isFromAI: true,
          createdAt: true,
        },
      })

      context = buildLeadContext(lead, messages)
    } else {
      const contact = await db.contact.findUnique({ where: { id } })

      if (!contact) {
        return NextResponse.json({ error: 'Contacto no encontrado.' }, { status: 404 })
      }

      context = buildContactContext(contact)
    }

    const prompt = [
      'Actua como coordinador comercial senior para una empresa de ingenieria, arquitectura y construccion.',
      'Tu trabajo es ayudar al equipo humano a entender rapidamente el caso, priorizarlo y proponer el siguiente contacto.',
      'No inventes datos. Usa solo la informacion entregada.',
      'Devuelve solo JSON valido con estas claves exactas:',
      '{',
      '  "summary": "resumen ejecutivo en 2 o 3 frases",',
      '  "priority": "low|normal|high|urgent",',
      '  "recommendedChannel": "email|phone|whatsapp|telegram",',
      '  "nextAction": "siguiente accion concreta para el equipo",',
      '  "outreachMessage": "mensaje breve sugerido para contactar al cliente"',
      '}',
      '',
      'Contexto de la empresa y proyectos publicados:',
      projectsContext,
      '',
      'Caso a analizar:',
      context,
    ].join('\n')

    const generation = await generateAutomationResponse(config, prompt)
    const parsed = JSON.parse(extractJsonBlock(generation.output)) as Record<string, unknown>
    const suggestion = {
      summary: normalizeText(parsed.summary),
      priority: normalizeChoice(normalizeText(parsed.priority), ['low', 'normal', 'high', 'urgent'], 'normal'),
      recommendedChannel: normalizeChoice(normalizeText(parsed.recommendedChannel), ['email', 'phone', 'whatsapp', 'telegram'], 'email'),
      nextAction: normalizeText(parsed.nextAction),
      outreachMessage: normalizeText(parsed.outreachMessage),
      provider: generation.provider,
      model: generation.model,
    }

    if (target === 'lead') {
      persisted = await db.leadCapture.update({
        where: { id },
        data: {
          summary: suggestion.summary || null,
          nextAction: suggestion.nextAction || null,
          priority: suggestion.priority,
          preferredContactChannel: suggestion.recommendedChannel,
        },
      })
    } else {
      persisted = await db.contact.update({
        where: { id },
        data: {
          aiSummary: suggestion.summary || null,
          nextAction: suggestion.nextAction || null,
          priority: suggestion.priority,
        },
      })
    }

    return NextResponse.json({
      success: true,
      target,
      suggestion,
      record: persisted,
    })
  } catch (error) {
    console.error('Error generating CRM summary:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo generar el resumen del caso' },
      { status: 500 },
    )
  }
}
