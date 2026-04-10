import { NextResponse } from 'next/server'
import { hashUserPassword, normalizeUsername, requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

function sanitizeRole(role: unknown) {
  return role === 'admin' ? 'admin' : 'editor'
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const { id } = await params
    const body = await request.json()
    const current = await db.adminUser.findUnique({ where: { id } })

    if (!current) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const nextUsername =
      typeof body.username === 'string' && body.username.trim().length > 0
        ? normalizeUsername(body.username)
        : current.username

    if (nextUsername !== current.username) {
      const existing = await db.adminUser.findUnique({
        where: { username: nextUsername },
        select: { id: true },
      })

      if (existing && existing.id !== id) {
        return NextResponse.json({ error: 'Ese usuario ya existe.' }, { status: 409 })
      }
    }

    const updateData: {
      username: string
      displayName: string | null
      role: string
      active: boolean
      telegramChatId: string | null
      contactPhone: string | null
      workloadCapacity: number
      receiveLeadAlerts: boolean
      passwordHash?: string
    } = {
      username: nextUsername,
      displayName: typeof body.displayName === 'string' ? body.displayName.trim() || null : current.displayName,
      role: sanitizeRole(body.role ?? current.role),
      active: typeof body.active === 'boolean' ? body.active : current.active,
      telegramChatId:
        typeof body.telegramChatId === 'string' ? body.telegramChatId.trim() || null : current.telegramChatId,
      contactPhone:
        typeof body.contactPhone === 'string' ? body.contactPhone.trim() || null : current.contactPhone,
      workloadCapacity:
        typeof body.workloadCapacity === 'number' && Number.isFinite(body.workloadCapacity)
          ? Math.max(1, Math.round(body.workloadCapacity))
          : current.workloadCapacity,
      receiveLeadAlerts:
        typeof body.receiveLeadAlerts === 'boolean' ? body.receiveLeadAlerts : current.receiveLeadAlerts,
    }

    if (typeof body.password === 'string' && body.password.trim().length >= 6) {
      updateData.passwordHash = hashUserPassword(body.password.trim())
    }

    const user = await db.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        active: true,
        telegramChatId: true,
        contactPhone: true,
        workloadCapacity: true,
        receiveLeadAlerts: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating admin user:', error)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const { id } = await params
    await db.adminUser.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting admin user:', error)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
