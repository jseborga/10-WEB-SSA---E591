import { NextResponse } from 'next/server'
import { createAutomationLog } from '@/lib/automation-log'
import { ensureTelegramConfig, processTelegramUpdate } from '@/lib/telegram'

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

    if (config.webhookSecret && secretHeader !== config.webhookSecret) {
      await createAutomationLog({
        source: 'telegram',
        eventType: 'webhook.rejected',
        status: 'rejected',
        summary: 'Webhook de Telegram rechazado por secret token invalido',
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
