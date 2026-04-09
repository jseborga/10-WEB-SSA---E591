import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeChoice(value: unknown, fallback: string, allowed: string[]) {
  const normalized = normalizeText(value)
  return allowed.includes(normalized) ? normalized : fallback
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))

    const lead = await db.leadCapture.update({
      where: { id },
      data: {
        name: normalizeText(body.name) || null,
        email: normalizeText(body.email) || null,
        phone: normalizeText(body.phone) || null,
        telegramHandle: normalizeText(body.telegramHandle) || null,
        preferredContactChannel: normalizeChoice(body.preferredContactChannel, '', ['', 'whatsapp', 'email', 'phone', 'telegram']) || null,
        contactConsent: Boolean(body.contactConsent),
        contactConsentAt: Boolean(body.contactConsent) ? normalizeDate(body.contactConsentAt) || new Date() : null,
        serviceType: normalizeText(body.serviceType) || null,
        projectType: normalizeText(body.projectType) || null,
        projectLocation: normalizeText(body.projectLocation) || null,
        projectIdea: normalizeText(body.projectIdea) || null,
        summary: normalizeText(body.summary) || null,
        leadStatus: normalizeChoice(body.leadStatus, 'new', ['new', 'contacted', 'proposal', 'won', 'lost', 'archived']),
        priority: normalizeChoice(body.priority, 'normal', ['low', 'normal', 'high', 'urgent']),
        ownerName: normalizeText(body.ownerName) || null,
        nextAction: normalizeText(body.nextAction) || null,
        nextFollowUpAt: normalizeDate(body.nextFollowUpAt),
        lastContactedAt: normalizeDate(body.lastContactedAt),
        internalNotes: normalizeText(body.internalNotes) || null,
        needsHuman: Boolean(body.needsHuman),
        qualified: Boolean(body.qualified),
      },
    })

    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error updating chat lead:', error)
    return NextResponse.json({ error: 'No se pudo actualizar el lead' }, { status: 500 })
  }
}
