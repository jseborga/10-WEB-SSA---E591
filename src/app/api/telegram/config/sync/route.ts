import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { syncTelegramWebhook } from '@/lib/telegram'

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const webhookInfo = await syncTelegramWebhook()
    return NextResponse.json({ success: true, webhookInfo })
  } catch (error) {
    console.error('Error syncing Telegram webhook:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo sincronizar el webhook' },
      { status: 500 },
    )
  }
}
