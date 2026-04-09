import { generateChatResponse } from '@/lib/chat-provider'

type ProviderConfig = {
  provider: string
  apiKey?: string | null
  apiBaseUrl?: string | null
  model?: string | null
  systemPrompt: string
  temperature: number
  maxTokens: number
}

type LeadDraft = {
  name?: string
  email?: string
  phone?: string
  telegramHandle?: string
  preferredContactChannel?: string
  contactConsent?: boolean
  serviceType?: string
  projectType?: string
  projectLocation?: string
  projectIdea?: string
  summary?: string
  needsHuman?: boolean
}

export function buildProjectsContext(
  projects: Array<{
    title: string
    category: string
    location?: string | null
    description?: string | null
  }>,
) {
  if (projects.length === 0) {
    return 'No hay proyectos publicados cargados todavía.'
  }

  return projects
    .slice(0, 8)
    .map((project) =>
      [
        `- ${project.title}`,
        project.category ? `categoria: ${project.category}` : null,
        project.location ? `ubicacion: ${project.location}` : null,
        project.description ? `descripcion: ${project.description}` : null,
      ]
        .filter(Boolean)
        .join(' | '),
    )
    .join('\n')
}

export function buildLeadSalesInstructions(language: string) {
  if (language === 'en') {
    return [
      'Be warm, helpful, and commercially proactive without sounding pushy.',
      'Your goal is to qualify the lead step by step.',
      'If any of these are missing, ask for them naturally, one at a time: full name, phone or WhatsApp, email, optional Telegram handle, preferred contact channel, service needed, project location, and a short project idea.',
      'Before closing the lead, confirm the visitor authorizes follow-up contact.',
      'Do not ask all questions at once.',
      'When enough data is available, summarize the opportunity and offer human follow-up.',
      'If the user is unsure, guide them with examples.',
    ].join('\n')
  }

  if (language === 'pt') {
    return [
      'Seja cordial, útil e comercialmente proativo sem soar agressivo.',
      'Seu objetivo é qualificar o lead passo a passo.',
      'Se faltarem dados, peça naturalmente, um de cada vez: nome completo, telefone ou WhatsApp, email, Telegram opcional, canal preferido de contato, serviço desejado, localização do projeto e uma ideia breve do projeto.',
      'Antes de encerrar o lead, confirme se a pessoa autoriza o contato posterior.',
      'Não faça todas as perguntas de uma vez.',
      'Quando tiver contexto suficiente, resuma a oportunidade e ofereça atendimento humano.',
      'Se a pessoa não souber como explicar, ajude com exemplos.',
    ].join('\n')
  }

  return [
    'Responde de forma amable, útil y comercialmente proactiva, sin sonar agresivo.',
    'Tu objetivo es calificar el lead paso a paso.',
    'Si faltan datos, pide naturalmente, uno por vez: nombre completo, teléfono o WhatsApp, correo, Telegram opcional, canal preferido de contacto, servicio que necesita, ubicación del proyecto y una idea breve del proyecto.',
    'Antes de cerrar el lead, confirma si la persona autoriza que el equipo la contacte.',
    'No hagas todas las preguntas al mismo tiempo.',
    'Cuando ya tengas suficiente contexto, resume la oportunidad y ofrece seguimiento humano.',
    'Si la persona no sabe cómo explicarlo, ayúdala con ejemplos.',
  ].join('\n')
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

function normalizeLeadValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function extractEmail(raw: string) {
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match?.[0] || ''
}

export function extractPhone(raw: string) {
  const match = raw.match(/(\+?\d[\d\s().-]{6,}\d)/)
  return match?.[0]?.trim() || ''
}

export function extractTelegramHandle(raw: string) {
  const match = raw.match(/(^|\s)@([a-zA-Z0-9_]{5,32})\b/)
  return match?.[2] ? `@${match[2]}` : ''
}

export function inferContactConsent(raw: string) {
  return /(autorizo|autorizacion|pueden contactarme|pueden escribirme|si pueden|si pueden contactarme|ok contactar|consiento|consentimiento|yes contact|you can contact me|authorized|autorizado|podem entrar em contato)/i.test(
    raw,
  )
}

export async function extractLeadDataWithAi(input: {
  config: ProviderConfig
  language: string
  transcript: string
}) {
  const prompt =
    input.language === 'en'
      ? [
          'Extract sales lead information from this chat transcript.',
          'Return only valid JSON.',
          'Do not invent missing values.',
          'JSON keys: name, email, phone, telegramHandle, preferredContactChannel, contactConsent, serviceType, projectType, projectLocation, projectIdea, summary, needsHuman.',
          input.transcript,
        ].join('\n\n')
      : input.language === 'pt'
        ? [
            'Extraia informações comerciais deste histórico de conversa.',
            'Retorne apenas JSON válido.',
            'Não invente valores faltantes.',
            'Chaves JSON: name, email, phone, telegramHandle, preferredContactChannel, contactConsent, serviceType, projectType, projectLocation, projectIdea, summary, needsHuman.',
            input.transcript,
          ].join('\n\n')
        : [
            'Extrae información comercial de este historial de conversación.',
            'Devuelve solo JSON válido.',
            'No inventes datos faltantes.',
            'Claves JSON: name, email, phone, telegramHandle, preferredContactChannel, contactConsent, serviceType, projectType, projectLocation, projectIdea, summary, needsHuman.',
            input.transcript,
          ].join('\n\n')

  const raw = await generateChatResponse(
    {
      ...input.config,
      temperature: Math.min(input.config.temperature, 0.3),
      maxTokens: Math.min(input.config.maxTokens, 400),
    },
    [],
    prompt,
  )

  const parsed = JSON.parse(extractJsonBlock(raw)) as Record<string, unknown>

  const lead: LeadDraft = {
    name: normalizeLeadValue(parsed.name),
    email: normalizeLeadValue(parsed.email),
    phone: normalizeLeadValue(parsed.phone),
    telegramHandle: normalizeLeadValue(parsed.telegramHandle),
    preferredContactChannel: normalizeLeadValue(parsed.preferredContactChannel),
    contactConsent: Boolean(parsed.contactConsent),
    serviceType: normalizeLeadValue(parsed.serviceType),
    projectType: normalizeLeadValue(parsed.projectType),
    projectLocation: normalizeLeadValue(parsed.projectLocation),
    projectIdea: normalizeLeadValue(parsed.projectIdea),
    summary: normalizeLeadValue(parsed.summary),
    needsHuman: Boolean(parsed.needsHuman),
  }

  return lead
}

export async function generateSalesPromptWithAi(input: {
  config: ProviderConfig
  language: 'es' | 'en' | 'pt'
  companyName: string
  companyInfo: string
  contactEmail?: string | null
  contactPhone?: string | null
  whatsapp?: string | null
  address?: string | null
  projectsContext: string
}) {
  const prompt =
    input.language === 'en'
      ? [
          'Create a sales-oriented system prompt for a website assistant of an engineering and construction company.',
          'The assistant must be warm, helpful, lead-oriented, and ask follow-up questions naturally.',
          'It must capture name, phone or WhatsApp, email, optional Telegram handle, preferred contact channel, service needed, project location, project idea, and contact permission.',
          'It must not invent technical or commercial data.',
          'Return only valid JSON with keys: systemPrompt, welcomeMessage, fallbackMessage.',
          JSON.stringify(input, null, 2),
        ].join('\n\n')
      : input.language === 'pt'
        ? [
            'Crie um prompt de sistema orientado a vendas para um assistente de site de uma empresa de engenharia e construção.',
            'O assistente deve ser cordial, útil, orientado a leads e fazer perguntas de seguimento de forma natural.',
            'Ele deve capturar nome, telefone ou WhatsApp, email, Telegram opcional, canal preferido de contato, serviço desejado, localização do projeto, ideia do projeto e permissão de contato.',
            'Não deve inventar dados técnicos ou comerciais.',
            'Retorne apenas JSON válido com as chaves: systemPrompt, welcomeMessage, fallbackMessage.',
            JSON.stringify(input, null, 2),
          ].join('\n\n')
        : [
            'Crea un prompt de sistema orientado a ventas para un asistente web de una empresa de ingeniería y construcción.',
            'El asistente debe ser amable, útil, orientado a leads y hacer preguntas de seguimiento de forma natural.',
            'Debe capturar nombre, teléfono o WhatsApp, correo, Telegram opcional, canal preferido de contacto, servicio que necesita, ubicación del proyecto, idea del proyecto y permiso de contacto.',
            'No debe inventar datos técnicos ni comerciales.',
            'Devuelve solo JSON válido con las claves: systemPrompt, welcomeMessage, fallbackMessage.',
            JSON.stringify(input, null, 2),
          ].join('\n\n')

  const raw = await generateChatResponse(
    {
      ...input.config,
      temperature: Math.min(input.config.temperature, 0.4),
      maxTokens: Math.min(input.config.maxTokens, 900),
    },
    [],
    prompt,
  )

  const parsed = JSON.parse(extractJsonBlock(raw)) as Record<string, unknown>

  return {
    systemPrompt: normalizeLeadValue(parsed.systemPrompt),
    welcomeMessage: normalizeLeadValue(parsed.welcomeMessage),
    fallbackMessage: normalizeLeadValue(parsed.fallbackMessage),
  }
}
