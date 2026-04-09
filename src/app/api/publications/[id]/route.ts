import { NextResponse } from 'next/server'
import { isAdminAuthenticated, requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { ensureUniquePublicationSlug, normalizeSeoKeywords, slugifyPublicationValue } from '@/lib/publications'

function parseMenuOrder(value: unknown) {
  return typeof value === 'number' ? value : parseInt(String(value ?? ''), 10) || 0
}

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

    return NextResponse.json(publication)
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
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''

    if (!title) {
      return NextResponse.json({ error: 'El titulo es obligatorio' }, { status: 400 })
    }

    const slug = await ensureUniquePublicationSlug(body.slug || title, id)

    const publication = await db.publication.update({
      where: { id },
      data: {
        title,
        slug,
        excerpt: typeof body.excerpt === 'string' ? body.excerpt.trim() : null,
        content: typeof body.content === 'string' ? body.content.trim() : null,
        image: typeof body.image === 'string' ? body.image.trim() : null,
        seoTitle: typeof body.seoTitle === 'string' ? body.seoTitle.trim() : null,
        seoDescription: typeof body.seoDescription === 'string' ? body.seoDescription.trim() : null,
        seoKeywords: normalizeSeoKeywords(body.seoKeywords),
        published: Boolean(body.published),
        category: typeof body.category === 'string' ? slugifyPublicationValue(body.category) || body.category.trim() : null,
        showInMenu: Boolean(body.showInMenu),
        menuOrder: parseMenuOrder(body.menuOrder),
      },
    })

    return NextResponse.json(publication)
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
    const unauthorized = await requireAuthenticatedUser(request)

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
