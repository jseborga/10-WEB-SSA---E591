import { db } from '@/lib/db'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

export function parseTelegramIdList(value: string | null | undefined) {
  return (value || '')
    .split(/[\n,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function telegramApi<T>(botToken: string, method: string, body?: Record<string, unknown>) {
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

export async function sendTelegramTextMessage(botToken: string, chatId: string, text: string) {
  return telegramApi(botToken, 'sendMessage', {
    chat_id: chatId,
    text,
  })
}

export async function sendConfiguredTelegramText(chatIds: string[], text: string) {
  const config = await db.telegramConfig.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (!config?.enabled || !config.botToken) {
    return { sent: false, reason: 'telegram-disabled' as const }
  }

  const recipients = Array.from(new Set(chatIds.map((item) => item.trim()).filter(Boolean)))

  if (recipients.length === 0) {
    return { sent: false, reason: 'no-recipient' as const }
  }

  for (const chatId of recipients) {
    await sendTelegramTextMessage(config.botToken, chatId, text)
  }

  return { sent: true, reason: 'sent' as const }
}
