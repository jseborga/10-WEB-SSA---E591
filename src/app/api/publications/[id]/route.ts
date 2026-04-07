import { NextResponse } from 'next/server'
import { isAdminAuthenticated, requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

// GET - Obtener publicación por ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const publication = await db.publication.findUnique({
      where: { id }
    })

    if (!publication) {
      return NextResponse.json(
        { error: 'Publicación no encontrada' },
        { status: 404 }
      )
    }

    if (!publication.published && !isAdminAuthenticated(request)) {
      return NextResponse.json(
        { error: 'Publicación no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(publication)
  } catch (error) {
    console.error('Error fetching publication:', error)
    return NextResponse.json(
      { error: 'Error al obtener publicación' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar publicación
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const { id } = await params
    const body = await request.json()
    const { title, slug, excerpt, content, image, published, category } = body

    const publication = await db.publication.update({
      where: { id },
      data: {
        title,
        slug,
        excerpt,
        content,
        image,
        published,
        category
      }
    })

    return NextResponse.json(publication)
  } catch (error) {
    console.error('Error updating publication:', error)
    return NextResponse.json(
      { error: 'Error al actualizar publicación' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar publicación
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const { id } = await params
    await db.publication.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting publication:', error)
    return NextResponse.json(
      { error: 'Error al eliminar publicación' },
      { status: 500 }
    )
  }
}
