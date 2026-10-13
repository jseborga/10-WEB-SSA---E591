import { NextResponse } from 'next/server'
import { requireAdmin, requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { META_PROVIDER, MetaGraphError, getMetaConnection, readTokenExpiration, resolveMetaPage, toSocialStatus } from '@/lib/meta-graph'

export async function GET(request: Request) {
  const unauthorized = await requireAuthenticatedUser(request)
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json(toSocialStatus(await getMetaConnection()))
  } catch (error) {
    console.error('Error reading social connection:', error instanceof Error ? error.message : 'desconocido')
    return NextResponse.json({ error: 'No se pudo leer la conexión con Meta' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const unauthorized = await requireAdmin(request)
  if (unauthorized) return unauthorized

  const body = (await request.json().catch(() => ({}))) as { accessToken?: unknown; pageId?: unknown; autoPublish?: unknown }
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
  const pageId = typeof body.pageId === 'string' ? body.pageId.trim() : ''

  // Solo cambiar autoPublish sin reconectar.
  if (!accessToken && typeof body.autoPublish === 'boolean') {
    const existing = await getMetaConnection()
    if (!existing) {
      return NextResponse.json({ error: 'Primero conecta una cuenta de Meta.' }, { status: 400 })
    }
    const updated = await db.socialConnection.update({
      where: { provider: META_PROVIDER },
      data: { autoPublish: body.autoPublish },
    })
    return NextResponse.json(toSocialStatus(updated))
  }

  if (!accessToken || accessToken.length < 20 || /\s/.test(accessToken)) {
    return NextResponse.json({ error: 'Pega un token de acceso válido de Meta.' }, { status: 400 })
  }

  if (pageId && !/^\d{5,25}$/.test(pageId)) {
    return NextResponse.json({ error: 'El Page ID debe ser numérico.' }, { status: 400 })
  }

  try {
    const { page, pageToken } = await resolveMetaPage(accessToken, pageId || null)
    const tokenExpiresAt = await readTokenExpiration(pageToken)
    const data = {
      pageId: page.id,
      pageName: page.name || null,
      igUserId: page.instagram_business_account?.id || null,
      igUsername: page.instagram_business_account?.username || null,
      accessToken: pageToken,
      tokenExpiresAt,
      lastSyncError: null,
      ...(typeof body.autoPublish === 'boolean' ? { autoPublish: body.autoPublish } : {}),
    }

    const saved = await db.socialConnection.upsert({
      where: { provider: META_PROVIDER },
      create: { provider: META_PROVIDER, ...data },
      update: data,
    })

    return NextResponse.json(toSocialStatus(saved))
  } catch (error) {
    if (error instanceof MetaGraphError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Error connecting Meta account:', error instanceof Error ? error.message : 'desconocido')
    return NextResponse.json({ error: 'No se pudo conectar la cuenta de Meta' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireAdmin(request)
  if (unauthorized) return unauthorized

  try {
    await db.socialConnection.deleteMany({ where: { provider: META_PROVIDER } })
    return NextResponse.json(toSocialStatus(null))
  } catch (error) {
    console.error('Error disconnecting Meta account:', error instanceof Error ? error.message : 'desconocido')
    return NextResponse.json({ error: 'No se pudo desconectar la cuenta' }, { status: 500 })
  }
}
