import { NextResponse } from 'next/server'
import { createAutomationLog } from '@/lib/automation-log'
import { ensureTelegramConfig, processTelegramUpdate } from '@/lib/telegram'

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

export async function GET() {
  const config = await ensureTelegramConfig().catch(() => null)

  return NextResponse.json({
    ok: true,
    enabled: Boolean(config?.enabled),
    endpoint: '/api/telegram/webhook',
  })
}

export async function POST(request: Request) {
  try {
    const config = await ensureTelegramConfig()
    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token')?.trim() || ''

    if (!config.webhookSecret || !safeEqual(secretHeader, config.webhookSecret)) {
      await createAutomationLog({
        source: 'telegram',
        eventType: 'webhook.rejected',
        status: 'rejected',
        summary: config.webhookSecret
          ? 'Webhook de Telegram rechazado por secret token invalido'
          : 'Webhook de Telegram rechazado: falta secret token (vuelve a sincronizar el webhook)',
      })

      return NextResponse.json({ error: 'Secret token invalido' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const result = await processTelegramUpdate(body)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error('Error processing Telegram webhook:', error)
    await createAutomationLog({
      source: 'telegram',
      eventType: 'webhook.error',
      status: 'error',
      summary: 'Fallo procesando el webhook de Telegram',
      payload: {
        error: error instanceof Error ? error.message : 'unknown',
      },
    }).catch(() => undefined)

    return NextResponse.json({ error: 'Error al procesar webhook' }, { status: 500 })
  }
}
