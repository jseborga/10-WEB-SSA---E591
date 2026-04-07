import { NextResponse } from 'next/server'
import { isAdminAuthenticated, requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

function normalizeGallery(gallery: unknown) {
  if (Array.isArray(gallery)) {
    return JSON.stringify(gallery.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))
  }

  if (typeof gallery === 'string' && gallery.trim().length > 0) {
    return gallery
  }

  return null
}

function normalizeYear(year: unknown) {
  if (typeof year === 'number' && Number.isFinite(year)) {
    return year
  }

  if (typeof year === 'string' && year.trim().length > 0) {
    const parsed = parseInt(year, 10)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

// GET - Obtener proyecto por ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await db.project.findUnique({
      where: { id }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado' },
        { status: 404 }
      )
    }

    if (!project.published && !isAdminAuthenticated(request)) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json(
      { error: 'Error al obtener proyecto' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar proyecto
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const { id } = await params
    const body = await request.json()
    const {
      title,
      description,
      fullDescription,
      category,
      location,
      year,
      area,
      featured,
      mainImage,
      gallery,
      videoUrl,
      client,
      status,
      published,
    } = body

    const project = await db.project.update({
      where: { id },
      data: {
        title,
        description,
        fullDescription,
        category,
        location,
        year: normalizeYear(year),
        area,
        featured: Boolean(featured),
        mainImage: mainImage || body.images || null,
        gallery: normalizeGallery(gallery),
        videoUrl: videoUrl || null,
        client: client || null,
        status: status || null,
        published: Boolean(published),
        publishedAt: published ? new Date() : null,
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Error al actualizar proyecto: ${error.message}`
            : 'Error al actualizar proyecto',
      },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar proyecto
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const { id } = await params
    await db.project.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json(
      { error: 'Error al eliminar proyecto' },
      { status: 500 }
    )
  }
}
