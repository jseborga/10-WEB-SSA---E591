import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const reviews = await db.approvalItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 120,
    })

    return NextResponse.json(reviews)
  } catch (error) {
    console.error('Error loading reviews:', error)
    return NextResponse.json({ error: 'No se pudieron cargar las revisiones' }, { status: 500 })
  }
}
