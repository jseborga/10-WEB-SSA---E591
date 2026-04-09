import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeChoice<T extends string>(value: unknown, fallback: T, options: readonly T[]) {
  return typeof value === 'string' && options.includes(value as T) ? (value as T) : fallback
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const contact = await db.contact.update({
      where: { id },
      data: {
        name: normalizeText(body.name),
        email: normalizeText(body.email),
        phone: normalizeText(body.phone) || null,
        subject: normalizeText(body.subject) || null,
        message: normalizeText(body.message),
        isRead: body.isRead !== false,
        status: normalizeChoice(body.status, 'new', ['new', 'contacted', 'proposal', 'won', 'lost', 'archived']),
        priority: normalizeChoice(body.priority, 'normal', ['low', 'normal', 'high', 'urgent']),
        ownerName: normalizeText(body.ownerName) || null,
        nextAction: normalizeText(body.nextAction) || null,
        nextFollowUpAt: normalizeDate(body.nextFollowUpAt),
        lastContactedAt: normalizeDate(body.lastContactedAt),
        internalNotes: normalizeText(body.internalNotes) || null,
        aiSummary: normalizeText(body.aiSummary) || null,
      },
    })

    return NextResponse.json(contact)
  } catch (error) {
    console.error('Error updating contact:', error)
    return NextResponse.json({ error: 'No se pudo actualizar el contacto' }, { status: 500 })
  }
}
