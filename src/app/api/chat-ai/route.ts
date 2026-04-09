import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateChatResponse } from '@/lib/chat-provider'
import { notifyTelegramHumanHandoff } from '@/lib/chat-handoff'
import {
  buildLeadSalesInstructions,
  buildProjectsContext,
  extractEmail,
  extractLeadDataWithAi,
  extractPhone,
  extractTelegramHandle,
  inferContactConsent,
} from '@/lib/chat-sales'

type HistoryMessage = {
  role: string
  content: string
}

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function shouldEscalateToHuman(message: string, fallbackUsed: boolean) {
  if (fallbackUsed) {
    return true
  }

  const normalized = normalizeText(message)
  return /(contacto|humano|asesor|agente|llamar|llamada|whatsapp|telefono|cotizacion|presupuesto|precio|reunion|visita|email|correo)/.test(
    normalized,
  )
}

function normalizePreferredContactChannel(value: string | null | undefined) {
  const normalized = normalizeText(value)

  if (!normalized) {
    return ''
  }

  if (/(whatsapp|wsp|wa)/.test(normalized)) {
    return 'whatsapp'
  }

  if (/(telegram|tg)/.test(normalized)) {
    return 'telegram'
  }

  if (/(correo|email|mail)/.test(normalized)) {
    return 'email'
  }

  if (/(telefono|teléfono|phone|llamada|call)/.test(normalized)) {
    return 'phone'
  }

  return ''
}

function buildContactCollectionRules(language: string) {
  if (language === 'en') {
    return [
      'Lead capture rules:',
      '- Ask for phone or WhatsApp, email, and optional Telegram handle when missing.',
      '- Ask which contact channel the visitor prefers.',
      '- Ask for explicit permission before saying the team will contact them.',
    ].join('\n')
  }

  if (language === 'pt') {
    return [
      'Regras de captacao:',
      '- Peca telefone ou WhatsApp, email e Telegram opcional quando faltarem.',
      '- Pergunte qual canal de contato a pessoa prefere.',
      '- Peca autorizacao explicita antes de afirmar que a equipe vai contata-la.',
    ].join('\n')
  }

  return [
    'Reglas de captacion:',
    '- Pide telefono o WhatsApp, correo y Telegram opcional cuando falten.',
    '- Pregunta cual canal de contacto prefiere la persona.',
    '- Pide autorizacion explicita antes de confirmar que el equipo la contactara.',
  ].join('\n')
}

function getHandoffNote(language: string, delivered: boolean) {
  if (language === 'en') {
    return delivered
      ? 'A human contact request was forwarded to our team.'
      : 'If you need human assistance, please contact our team directly.'
  }

  if (language === 'pt') {
    return delivered
      ? 'Uma solicitação de contato humano foi enviada para nossa equipe.'
      : 'Se precisar de atendimento humano, entre em contato com nossa equipe.'
  }

  return delivered
    ? 'Se notificó al equipo para continuar el contacto humano.'
    : 'Si necesitas atención humana, contáctanos directamente.'
}

function resolveFallback(
  config: {
    fallbackMessage: string | null
    fallbackMessageEn: string | null
    fallbackMessagePt: string | null
  },
  language: string,
) {
  if (language === 'en' && config.fallbackMessageEn) {
    return config.fallbackMessageEn
  }

  if (language === 'pt' && config.fallbackMessagePt) {
    return config.fallbackMessagePt
  }

  return config.fallbackMessage || 'No puedo responder eso en este momento.'
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId, message, history = [], language = 'es', name = 'Visitante', email = '' } = body

    if (!message) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })
    }

    const config = await db.chatConfig.findFirst()

    if (!config || !config.enabled) {
      return NextResponse.json({ error: 'Chatbot no está habilitado' }, { status: 403 })
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

    let systemPrompt = config.systemPrompt
    if (language === 'en' && config.systemPromptEn) {
      systemPrompt = config.systemPromptEn
    } else if (language === 'pt' && config.systemPromptPt) {
      systemPrompt = config.systemPromptPt
    }

    const projectsContext = buildProjectsContext(publishedProjects)
    const enrichedSystemPrompt = [
      systemPrompt,
      '',
      buildLeadSalesInstructions(language),
      '',
      buildContactCollectionRules(language),
      '',
      'Datos actuales de la empresa y el sitio:',
      `- Empresa: ${siteSettings?.companyName || config.companyName}`,
      siteSettings?.tagline ? `- Eslogan: ${siteSettings.tagline}` : null,
      siteSettings?.email ? `- Correo: ${siteSettings.email}` : null,
      siteSettings?.phone ? `- Telefono: ${siteSettings.phone}` : null,
      siteSettings?.whatsapp ? `- WhatsApp: ${siteSettings.whatsapp}` : null,
      siteSettings?.addressLine ? `- Direccion: ${siteSettings.addressLine}` : null,
      siteSettings?.city ? `- Ciudad: ${siteSettings.city}` : null,
      siteSettings?.projectCategories ? `- Categorias y servicios clave: ${siteSettings.projectCategories}` : null,
      config.companyInfo ? `- Perfil empresa: ${config.companyInfo}` : null,
      '',
      'Proyectos publicados o categorias de referencia:',
      projectsContext,
    ]
      .filter(Boolean)
      .join('\n')

    const normalizedHistory = (history as HistoryMessage[])
      .filter((msg) => typeof msg?.content === 'string' && msg.content.trim())
      .map((msg) => ({
        role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: msg.content.trim(),
      }))

    const persistedHistory = sessionId
      ? (
          await db.chatMessage.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
            take: 16,
          })
        ).map((item) => ({
          role: item.isFromAdmin ? ('assistant' as const) : ('user' as const),
          content: item.message,
        }))
      : []

    const effectiveHistory = persistedHistory.length > 0 ? persistedHistory : normalizedHistory

    let aiResponse = ''
    let usedFallback = false

    try {
      aiResponse = await generateChatResponse(
        {
          provider: config.provider,
          apiKey: config.apiKey,
          apiBaseUrl: config.apiBaseUrl,
          model: config.model,
          systemPrompt: enrichedSystemPrompt,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        },
        effectiveHistory,
        message,
      )
    } catch (providerError) {
      console.error('Error generating AI response:', providerError)
      aiResponse = resolveFallback(config, language)
      usedFallback = true
    }

    if (!aiResponse) {
      aiResponse = resolveFallback(config, language)
      usedFallback = true
    }

    if (sessionId) {
      await db.chatMessage.create({
        data: {
          sessionId,
          name: typeof name === 'string' && name.trim() ? name.trim() : 'Visitante',
          email: typeof email === 'string' && email.trim() ? email.trim() : null,
          message,
          isFromAdmin: false,
          isFromAI: false,
        },
      })

      await db.chatMessage.create({
        data: {
          sessionId,
          name: `${config.companyName} AI`,
          email: typeof email === 'string' && email.trim() ? email.trim() : null,
          message: aiResponse,
          isFromAdmin: true,
          isFromAI: true,
        },
      })
    }

    const transcript = [
      ...effectiveHistory.map((item) => `${item.role === 'assistant' ? 'Asistente' : 'Visitante'}: ${item.content}`),
      `Visitante: ${message}`,
      `Asistente: ${aiResponse}`,
    ].join('\n')

    let leadSuggestion = {
      name: typeof name === 'string' ? name.trim() : '',
      email: typeof email === 'string' ? email.trim() : '',
      phone: '',
      telegramHandle: '',
      preferredContactChannel: '',
      contactConsent: false,
      serviceType: '',
      projectType: '',
      projectLocation: '',
      projectIdea: '',
      summary: '',
      needsHuman: false,
    }

    try {
      const extracted = await extractLeadDataWithAi({
        config: {
          provider: config.provider,
          apiKey: config.apiKey,
          apiBaseUrl: config.apiBaseUrl,
          model: config.model,
          systemPrompt: enrichedSystemPrompt,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        },
        language,
        transcript,
      })

      leadSuggestion = {
        ...leadSuggestion,
        ...extracted,
      }
    } catch (leadError) {
      console.error('Error extracting lead data:', leadError)
    }

    if (!leadSuggestion.email) {
      leadSuggestion.email = extractEmail(`${message}\n${transcript}`) || leadSuggestion.email
    }

    if (!leadSuggestion.phone) {
      leadSuggestion.phone = extractPhone(`${message}\n${transcript}`) || leadSuggestion.phone
    }

    if (!leadSuggestion.telegramHandle) {
      leadSuggestion.telegramHandle = extractTelegramHandle(`${message}\n${transcript}`) || leadSuggestion.telegramHandle
    }

    leadSuggestion.preferredContactChannel =
      normalizePreferredContactChannel(leadSuggestion.preferredContactChannel) ||
      normalizePreferredContactChannel(`${message}\n${transcript}`) ||
      (leadSuggestion.phone ? 'whatsapp' : leadSuggestion.email ? 'email' : leadSuggestion.telegramHandle ? 'telegram' : '')

    if (!leadSuggestion.contactConsent) {
      leadSuggestion.contactConsent = inferContactConsent(`${message}\n${transcript}`)
    }

    const hasContactMethod = Boolean((leadSuggestion.email || '').trim() || (leadSuggestion.phone || '').trim() || (leadSuggestion.telegramHandle || '').trim())
    const hasProjectIntent = Boolean((leadSuggestion.projectIdea || '').trim() || (leadSuggestion.serviceType || '').trim())
    const needsHuman = shouldEscalateToHuman(message, usedFallback) || Boolean(leadSuggestion.needsHuman)
    const qualified = hasContactMethod && hasProjectIntent && Boolean(leadSuggestion.contactConsent)

    if (sessionId) {
      await db.leadCapture.upsert({
        where: { sessionId },
        update: {
          name: leadSuggestion.name || (typeof name === 'string' ? name.trim() : '') || undefined,
          email: leadSuggestion.email || (typeof email === 'string' ? email.trim() : '') || undefined,
          phone: leadSuggestion.phone || undefined,
          telegramHandle: leadSuggestion.telegramHandle || undefined,
          preferredContactChannel: leadSuggestion.preferredContactChannel || undefined,
          contactConsent: leadSuggestion.contactConsent ? true : undefined,
          contactConsentAt: leadSuggestion.contactConsent ? new Date() : undefined,
          serviceType: leadSuggestion.serviceType || undefined,
          projectType: leadSuggestion.projectType || undefined,
          projectLocation: leadSuggestion.projectLocation || undefined,
          projectIdea: leadSuggestion.projectIdea || undefined,
          summary: leadSuggestion.summary || undefined,
          lastVisitorMessage: message,
          needsHuman,
          qualified,
        },
        create: {
          sessionId,
          name: leadSuggestion.name || (typeof name === 'string' ? name.trim() : '') || null,
          email: leadSuggestion.email || (typeof email === 'string' ? email.trim() : '') || null,
          phone: leadSuggestion.phone || null,
          telegramHandle: leadSuggestion.telegramHandle || null,
          preferredContactChannel: leadSuggestion.preferredContactChannel || null,
          contactConsent: Boolean(leadSuggestion.contactConsent),
          contactConsentAt: leadSuggestion.contactConsent ? new Date() : null,
          serviceType: leadSuggestion.serviceType || null,
          projectType: leadSuggestion.projectType || null,
          projectLocation: leadSuggestion.projectLocation || null,
          projectIdea: leadSuggestion.projectIdea || null,
          summary: leadSuggestion.summary || null,
          lastVisitorMessage: message,
          needsHuman,
          qualified,
        },
      })
    }

    let telegramNotified = false

    if (needsHuman && sessionId) {
      try {
        const result = await notifyTelegramHumanHandoff({
          sessionId,
          visitorName: typeof name === 'string' && name.trim() ? name.trim() : 'Visitante',
          visitorEmail: leadSuggestion.email || (typeof email === 'string' && email.trim() ? email.trim() : null),
          visitorPhone: leadSuggestion.phone || null,
          visitorTelegram: leadSuggestion.telegramHandle || null,
          preferredContactChannel: leadSuggestion.preferredContactChannel || null,
          contactConsent: Boolean(leadSuggestion.contactConsent),
          serviceType: leadSuggestion.serviceType || leadSuggestion.projectType || null,
          projectLocation: leadSuggestion.projectLocation || null,
          projectIdea: leadSuggestion.projectIdea || null,
          summary: leadSuggestion.summary || null,
          message,
          aiResponse,
          companyName: config.companyName,
        })
        telegramNotified = result.sent

        if (result.sent) {
          await db.leadCapture.updateMany({
            where: { sessionId },
            data: { telegramNotified: true },
          })
        }
      } catch (telegramError) {
        console.error('Error notifying Telegram handoff:', telegramError)
      }
    }

    const finalResponse =
      needsHuman && !aiResponse.includes(getHandoffNote(language, telegramNotified))
        ? `${aiResponse}\n\n${getHandoffNote(language, telegramNotified)}`
        : aiResponse

    return NextResponse.json({
      success: true,
      response: finalResponse,
      provider: config.provider,
      fallbackUsed: usedFallback,
      needsHuman,
      telegramNotified,
      qualifiedLead: qualified,
    })
  } catch (error) {
    console.error('Error processing AI message:', error)
    return NextResponse.json({ error: 'Error al procesar mensaje' }, { status: 500 })
  }
}
