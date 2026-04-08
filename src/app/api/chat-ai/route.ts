import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateChatResponse } from '@/lib/chat-provider'
import { notifyTelegramHumanHandoff } from '@/lib/chat-handoff'

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
  return /(contacto|humano|asesor|agente|llamar|llamada|whatsapp|telefono|cotizacion|cotizacion|presupuesto|precio|reunion|visita|email|correo)/.test(normalized)
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

// POST - Procesar mensaje con IA
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId, message, history = [], language = 'es', name = 'Visitante', email = '' } = body

    if (!message) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })
    }

    // Obtener configuración
    const config = await db.chatConfig.findFirst()
    
    if (!config || !config.enabled) {
      return NextResponse.json({ error: 'Chatbot no está habilitado' }, { status: 403 })
    }

    // Seleccionar el system prompt según el idioma
    let systemPrompt = config.systemPrompt
    if (language === 'en' && config.systemPromptEn) {
      systemPrompt = config.systemPromptEn
    } else if (language === 'pt' && config.systemPromptPt) {
      systemPrompt = config.systemPromptPt
    }

    const normalizedHistory = (history as HistoryMessage[])
      .filter((msg) => typeof msg?.content === 'string' && msg.content.trim())
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
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
          systemPrompt,
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

    // Usar fallback si no hay respuesta
    if (!aiResponse) {
      aiResponse = resolveFallback(config, language)
      usedFallback = true
    }

    // Guardar mensaje en la base de datos
    if (sessionId) {
      await db.chatMessage.create({
        data: {
          sessionId,
          name: typeof name === 'string' && name.trim() ? name.trim() : 'Visitante',
          email: typeof email === 'string' && email.trim() ? email.trim() : null,
          message,
          isFromAdmin: false,
          isFromAI: false
        }
      })

      await db.chatMessage.create({
        data: {
          sessionId,
          name: config.companyName + ' AI',
          email: typeof email === 'string' && email.trim() ? email.trim() : null,
          message: aiResponse,
          isFromAdmin: true,
          isFromAI: true
        }
      })
    }

    const needsHuman = shouldEscalateToHuman(message, usedFallback)
    let telegramNotified = false

    if (needsHuman && sessionId) {
      try {
        const result = await notifyTelegramHumanHandoff({
          sessionId,
          visitorName: typeof name === 'string' && name.trim() ? name.trim() : 'Visitante',
          visitorEmail: typeof email === 'string' && email.trim() ? email.trim() : null,
          message,
          aiResponse,
          companyName: config.companyName,
        })
        telegramNotified = result.sent
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
    })
  } catch (error) {
    console.error('Error processing AI message:', error)
    return NextResponse.json({ error: 'Error al procesar mensaje' }, { status: 500 })
  }
}
