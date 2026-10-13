import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

/** Verifica que la clave de Google AI Studio funciona y que el modelo de imagen existe. */
export async function POST(request: Request) {
  const unauthorized = await requireAdmin(request)

  if (unauthorized) {
    return unauthorized
  }

  const config = await db.chatConfig.findFirst()
  const apiKey = config?.imageApiKey || config?.automationApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
  const model = config?.imageModel?.trim() || 'gemini-2.5-flash-image'
  const baseUrl = (config?.imageApiBaseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '')

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'No hay clave de Google AI Studio configurada.' }, { status: 400 })
  }

  const response = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}`, {
    headers: { 'x-goog-api-key': apiKey },
  })
  const data = (await response.json().catch(() => ({}))) as { displayName?: string; error?: { message?: string } }

  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: `Google respondió: ${data.error?.message || response.statusText}` },
      { status: 400 },
    )
  }

  return NextResponse.json({ ok: true, model, displayName: data.displayName || model })
}
