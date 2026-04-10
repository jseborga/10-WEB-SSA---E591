import { NextResponse } from 'next/server'
import { hashUserPassword, normalizeUsername, requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

function sanitizeRole(role: unknown) {
  return role === 'admin' ? 'admin' : 'editor'
}

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const users = await db.adminUser.findMany({
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
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

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching admin users:', error)
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json()
    const username = normalizeUsername(typeof body.username === 'string' ? body.username : '')
    const password = typeof body.password === 'string' ? body.password : ''

    if (!username || password.length < 6) {
      return NextResponse.json(
        { error: 'Debes indicar un usuario y una contraseña de al menos 6 caracteres.' },
        { status: 400 },
      )
    }

    const existingUser = await db.adminUser.findUnique({
      where: { username },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Ese usuario ya existe.' }, { status: 409 })
    }

    const user = await db.adminUser.create({
      data: {
        username,
        displayName: typeof body.displayName === 'string' ? body.displayName.trim() || null : null,
        passwordHash: hashUserPassword(password),
        role: sanitizeRole(body.role),
        active: body.active !== false,
        telegramChatId: typeof body.telegramChatId === 'string' ? body.telegramChatId.trim() || null : null,
        contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim() || null : null,
        workloadCapacity:
          typeof body.workloadCapacity === 'number' && Number.isFinite(body.workloadCapacity)
            ? Math.max(1, Math.round(body.workloadCapacity))
            : 10,
        receiveLeadAlerts: body.receiveLeadAlerts !== false,
      },
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

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Error creating admin user:', error)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}
