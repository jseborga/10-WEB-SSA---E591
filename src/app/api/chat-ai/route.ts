import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateChatResponse } from '@/lib/chat-provider'

type HistoryMessage = {
  role: string
  content: string
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
    const { sessionId, message, history = [], language = 'es' } = body

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
        normalizedHistory,
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
          name: 'Visitante',
          message,
          isFromAdmin: false,
          isFromAI: false
        }
      })

      await db.chatMessage.create({
        data: {
          sessionId,
          name: config.companyName + ' AI',
          message: aiResponse,
          isFromAdmin: true,
          isFromAI: true
        }
      })
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      provider: config.provider,
      fallbackUsed: usedFallback,
    })
  } catch (error) {
    console.error('Error processing AI message:', error)
    return NextResponse.json({ error: 'Error al procesar mensaje' }, { status: 500 })
  }
}
