import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { ensureTelegramConfig, getDefaultTelegramConfig } from '@/lib/telegram'

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const config = await ensureTelegramConfig()
    return NextResponse.json(config)
  } catch (error) {
    console.error('Error loading Telegram config:', error)
    return NextResponse.json(getDefaultTelegramConfig(), { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json()
    const current = await ensureTelegramConfig()

    const config = await db.telegramConfig.update({
      where: { id: current.id },
      data: {
        enabled: body.enabled ?? current.enabled,
        botToken: body.botToken ?? current.botToken,
        botUsername: body.botUsername ?? current.botUsername,
        webhookUrl: body.webhookUrl ?? current.webhookUrl,
        webhookSecret: body.webhookSecret ?? current.webhookSecret,
        allowedUserIds: body.allowedUserIds ?? current.allowedUserIds,
        allowedChatIds: body.allowedChatIds ?? current.allowedChatIds,
        autoCreateReviews: body.autoCreateReviews ?? current.autoCreateReviews,
        autoApproveKnownUsers: body.autoApproveKnownUsers ?? current.autoApproveKnownUsers,
        defaultProjectCategory: body.defaultProjectCategory ?? current.defaultProjectCategory,
        defaultProjectStatus: body.defaultProjectStatus ?? current.defaultProjectStatus,
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('Error updating Telegram config:', error)
    return NextResponse.json({ error: 'No se pudo guardar la configuracion de Telegram' }, { status: 500 })
  }
}
