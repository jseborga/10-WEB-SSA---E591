import { db } from '@/lib/db'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

function parseIdList(value: string | null | undefined) {
  return (value || '')
    .split(/[\n,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

async function telegramApi<T>(botToken: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
    cache: 'no-store',
  })

  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string }

  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API error (${response.status})`)
  }

  return data.result as T
}

export async function notifyTelegramHumanHandoff(input: {
  sessionId: string
  visitorName: string
  visitorEmail?: string | null
  visitorPhone?: string | null
  visitorTelegram?: string | null
  preferredContactChannel?: string | null
  contactConsent?: boolean
  serviceType?: string | null
  projectLocation?: string | null
  projectIdea?: string | null
  summary?: string | null
  message: string
  aiResponse?: string
  companyName: string
}) {
  const config = await db.telegramConfig.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (!config?.enabled || !config.botToken) {
    return { sent: false, reason: 'telegram-disabled' as const }
  }

  const recipients = Array.from(new Set([...parseIdList(config.allowedChatIds), ...parseIdList(config.allowedUserIds)])).slice(0, 5)

  if (recipients.length === 0) {
    return { sent: false, reason: 'no-recipient' as const }
  }

  const lines = [
    'Nueva solicitud de contacto humano desde el chat web',
    '',
    `Empresa: ${input.companyName}`,
    `Sesion: ${input.sessionId}`,
    `Nombre: ${input.visitorName || 'Visitante'}`,
    input.visitorEmail ? `Email: ${input.visitorEmail}` : null,
    input.visitorPhone ? `Telefono: ${input.visitorPhone}` : null,
    input.visitorTelegram ? `Telegram: ${input.visitorTelegram}` : null,
    input.preferredContactChannel ? `Canal preferido: ${input.preferredContactChannel}` : null,
    input.contactConsent ? 'Autorizo contacto: si' : 'Autorizo contacto: no confirmado',
    input.serviceType ? `Servicio: ${input.serviceType}` : null,
    input.projectLocation ? `Ubicacion: ${input.projectLocation}` : null,
    input.projectIdea ? `Idea del proyecto: ${input.projectIdea}` : null,
    input.summary ? `Resumen: ${input.summary}` : null,
    '',
    'Mensaje del visitante:',
    input.message,
    input.aiResponse ? '' : null,
    input.aiResponse ? 'Respuesta IA:' : null,
    input.aiResponse || null,
  ].filter(Boolean)

  for (const chatId of recipients) {
    await telegramApi(config.botToken, 'sendMessage', {
      chat_id: chatId,
      text: lines.join('\n'),
    })
  }

  return { sent: true, reason: 'sent' as const }
}
