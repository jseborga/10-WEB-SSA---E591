import { db } from '@/lib/db'

type AutomationLogInput = {
  source: string
  eventType: string
  status: string
  actorType?: string | null
  actorId?: string | null
  entityType?: string | null
  entityId?: string | null
  summary: string
  payload?: unknown
}

function normalizePayload(payload: unknown) {
  if (payload == null) {
    return null
  }

  try {
    return JSON.stringify(payload)
  } catch {
    return JSON.stringify({ error: 'payload_unserializable' })
  }
}

export async function createAutomationLog(input: AutomationLogInput) {
  return db.automationLog.create({
    data: {
      source: input.source,
      eventType: input.eventType,
      status: input.status,
      actorType: input.actorType || null,
      actorId: input.actorId || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      summary: input.summary,
      payload: normalizePayload(input.payload),
    },
  })
}

export function parseStoredJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
