import { db } from '@/lib/db'
import { parseTelegramIdList, sendConfiguredTelegramText } from '@/lib/telegram-notify'

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

  const recipients = Array.from(new Set([...parseTelegramIdList(config.allowedChatIds), ...parseTelegramIdList(config.allowedUserIds)])).slice(0, 5)

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

  return sendConfiguredTelegramText(recipients, lines.join('\n'))
}
