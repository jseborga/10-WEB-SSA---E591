import { NextResponse } from 'next/server'
import { getSessionFromRequest, requireAuthenticatedUser } from '@/lib/admin-auth'
import { approveTelegramReview, rejectTelegramReview } from '@/lib/telegram'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const session = getSessionFromRequest(request)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : ''

    if (action === 'approve') {
      const project = await approveTelegramReview(id, session.username)
      return NextResponse.json({ success: true, action, project })
    }

    if (action === 'reject') {
      const review = await rejectTelegramReview(id, session.username, typeof body.reason === 'string' ? body.reason : '')
      return NextResponse.json({ success: true, action, review })
    }

    return NextResponse.json({ error: 'Accion invalida' }, { status: 400 })
  } catch (error) {
    console.error('Error processing review:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo procesar la revision' },
      { status: 500 },
    )
  }
}
