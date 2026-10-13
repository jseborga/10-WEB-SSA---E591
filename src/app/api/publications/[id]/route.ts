import { NextResponse } from 'next/server'
import type { Prisma } from '@/lib/db'
import { isAdminAuthenticated, requireAdmin, requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { buildPublicationWriteData, ensureUniquePublicationSlug, toPublicationDTO } from '@/lib/publications'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const publication = await db.publication.findUnique({
      where: { id },
    })

    if (!publication) {
      return NextResponse.json({ error: 'Publicacion no encontrada' }, { status: 404 })
    }

    if (!publication.published && !isAdminAuthenticated(request)) {
      return NextResponse.json({ error: 'Publicacion no encontrada' }, { status: 404 })
    }

    return NextResponse.json(toPublicationDTO(publication))
  } catch (error) {
    console.error('Error fetching publication:', error)
    return NextResponse.json({ error: 'Error al obtener publicacion' }, { status: 500 })
  }
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
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : ''

    if (!title) {
      return NextResponse.json({ error: 'El titulo es obligatorio' }, { status: 400 })
    }

    const existing = await db.publication.findUnique({
      where: { id },
      select: { id: true, publishedAt: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Publicacion no encontrada' }, { status: 404 })
    }

    const slug = await ensureUniquePublicationSlug(typeof body.slug === 'string' && body.slug.trim() ? body.slug : title, id)
    const data = buildPublicationWriteData(body)

    // Se fija una sola vez, al publicar por primera vez (a menos que el cliente envíe una fecha).
    if (data.published && !existing.publishedAt && !data.publishedAt) {
      data.publishedAt = new Date()
    }

    const publication = await db.publication.update({
      where: { id },
      data: { ...data, title, slug } as Prisma.PublicationUpdateInput,
    })

    return NextResponse.json(toPublicationDTO(publication))
  } catch (error) {
    console.error('Error updating publication:', error)
    if (error instanceof Error && error.message.toLowerCase().includes('unique constraint')) {
      return NextResponse.json(
        { error: 'Ya existe una pagina con ese slug. Cambia el titulo o el slug.' },
        { status: 409 },
      )
    }

    return NextResponse.json({ error: 'Error al actualizar publicacion' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const { id } = await params
    await db.publication.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting publication:', error)
    return NextResponse.json({ error: 'Error al eliminar publicacion' }, { status: 500 })
  }
}
