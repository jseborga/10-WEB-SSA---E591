import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const logs = await db.automationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 120,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Error loading automation logs:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los logs' }, { status: 500 })
  }
}
