import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const leads = await db.leadCapture.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      take: 120,
    })

    return NextResponse.json(leads)
  } catch (error) {
    console.error('Error loading chat leads:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los leads del chat' }, { status: 500 })
  }
}
