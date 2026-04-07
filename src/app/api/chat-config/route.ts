import { NextResponse } from 'next/server'
import { isAdminAuthenticated, requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

function getDefaultChatConfig() {
  return {
    enabled: false,
    provider: 'openai-compatible',
    apiKey: null,
    apiBaseUrl: '',
    model: '',
    systemPrompt: `Eres el asistente virtual de SSA Ingenieria, una empresa dedicada a construccion, diseno, supervision, asesoria tecnica especializada, software a medida y ERP para construccion.

Tu trabajo es responder con claridad, de forma profesional y breve.

Informacion base:
- Nombre: SSA Ingenieria
- Ubicacion: Calle Lucas Jaimes # 76, Miraflores, La Paz, Bolivia
- Correo: admin@ingenieria.com.bo
- Telefono: +591 2241146
- WhatsApp: +591 76205333

Reglas:
1. Responde en el idioma del usuario.
2. Si no sabes algo, invita a contactar por correo o WhatsApp.
3. No inventes proyectos, precios ni plazos.
4. Mantén respuestas breves y utiles.`,
    systemPromptEn: `You are the virtual assistant for SSA Ingenieria, a company focused on construction, design, supervision, specialized technical consulting, custom software, and ERP for construction.

Your job is to answer clearly, professionally, and briefly.

Base information:
- Name: SSA Ingenieria
- Location: Calle Lucas Jaimes # 76, Miraflores, La Paz, Bolivia
- Email: admin@ingenieria.com.bo
- Phone: +591 2241146
- WhatsApp: +591 76205333

Rules:
1. Reply in the user's language.
2. If you do not know something, suggest contacting by email or WhatsApp.
3. Do not invent projects, pricing, or timelines.
4. Keep answers concise and useful.`,
    systemPromptPt: `Você é o assistente virtual da SSA Ingenieria, uma empresa focada em construção, design, supervisão, assessoria técnica especializada, software sob medida e ERP para construção.

Seu trabalho é responder com clareza, de forma profissional e breve.

Informações base:
- Nome: SSA Ingenieria
- Localização: Calle Lucas Jaimes # 76, Miraflores, La Paz, Bolivia
- Email: admin@ingenieria.com.bo
- Telefone: +591 2241146
- WhatsApp: +591 76205333

Regras:
1. Responda no idioma do usuário.
2. Se não souber algo, sugira contato por email ou WhatsApp.
3. Não invente projetos, preços ou prazos.
4. Mantenha respostas curtas e úteis.`,
    welcomeMessage: 'Hola. Soy el asistente virtual de SSA Ingenieria. ¿En qué puedo ayudarte?',
    welcomeMessageEn: 'Hello. I am SSA Ingenieria’s virtual assistant. How can I help you?',
    welcomeMessagePt: 'Olá. Sou o assistente virtual da SSA Ingenieria. Como posso ajudar?',
    fallbackMessage: 'No puedo responder eso con certeza en este momento. Escríbenos a admin@ingenieria.com.bo o por WhatsApp al +591 76205333.',
    fallbackMessageEn: 'I cannot answer that with certainty right now. Please contact us at admin@ingenieria.com.bo or WhatsApp +591 76205333.',
    fallbackMessagePt: 'Não consigo responder isso com certeza agora. Por favor escreva para admin@ingenieria.com.bo ou no WhatsApp +591 76205333.',
    companyName: 'SSA Ingenieria',
    companyInfo: 'Empresa de construccion, diseno, supervision, asesoria tecnica especializada, software a medida y ERP para construccion.',
    companyInfoEn: 'Construction, design, supervision, specialized technical consulting, custom software and ERP for construction company.',
    companyInfoPt: 'Empresa de construção, design, supervisão, assessoria técnica especializada, software sob medida e ERP para construção.',
    temperature: 0.4,
    maxTokens: 600,
  }
}

async function ensureChatConfig() {
  let config = await db.chatConfig.findFirst()

  if (!config) {
    config = await db.chatConfig.create({
      data: getDefaultChatConfig(),
    })
  }

  return config
}

function getPublicChatConfig(config: Awaited<ReturnType<typeof ensureChatConfig>>) {
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    welcomeMessage: config.welcomeMessage,
    welcomeMessageEn: config.welcomeMessageEn,
    welcomeMessagePt: config.welcomeMessagePt,
    fallbackMessage: config.fallbackMessage,
    fallbackMessageEn: config.fallbackMessageEn,
    fallbackMessagePt: config.fallbackMessagePt,
    companyName: config.companyName,
  }
}

export async function GET(request: Request) {
  try {
    const config = await ensureChatConfig()

    if (isAdminAuthenticated(request)) {
      return NextResponse.json(config)
    }

    return NextResponse.json(getPublicChatConfig(config))
  } catch (error) {
    console.error('Error fetching chat config:', error)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const unauthorized = requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json()
    const currentConfig = await ensureChatConfig()

    const config = await db.chatConfig.update({
      where: { id: currentConfig.id },
      data: {
        enabled: body.enabled ?? currentConfig.enabled,
        provider: body.provider ?? currentConfig.provider,
        apiKey: body.apiKey ?? currentConfig.apiKey,
        apiBaseUrl: body.apiBaseUrl ?? currentConfig.apiBaseUrl,
        model: body.model ?? currentConfig.model,
        systemPrompt: body.systemPrompt ?? currentConfig.systemPrompt,
        systemPromptEn: body.systemPromptEn ?? currentConfig.systemPromptEn,
        systemPromptPt: body.systemPromptPt ?? currentConfig.systemPromptPt,
        welcomeMessage: body.welcomeMessage ?? currentConfig.welcomeMessage,
        welcomeMessageEn: body.welcomeMessageEn ?? currentConfig.welcomeMessageEn,
        welcomeMessagePt: body.welcomeMessagePt ?? currentConfig.welcomeMessagePt,
        fallbackMessage: body.fallbackMessage ?? currentConfig.fallbackMessage,
        fallbackMessageEn: body.fallbackMessageEn ?? currentConfig.fallbackMessageEn,
        fallbackMessagePt: body.fallbackMessagePt ?? currentConfig.fallbackMessagePt,
        companyName: body.companyName ?? currentConfig.companyName,
        companyInfo: body.companyInfo ?? currentConfig.companyInfo,
        companyInfoEn: body.companyInfoEn ?? currentConfig.companyInfoEn,
        companyInfoPt: body.companyInfoPt ?? currentConfig.companyInfoPt,
        temperature: body.temperature ?? currentConfig.temperature,
        maxTokens: body.maxTokens ?? currentConfig.maxTokens,
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('Error updating chat config:', error)
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
  }
}
