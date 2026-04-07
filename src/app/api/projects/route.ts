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

// GET - Obtener todos los proyectos
export async function GET(request: Request) {
  try {
    const isAuthenticated = isAdminAuthenticated(request)
    const projects = await db.project.findMany({
      where: isAuthenticated ? undefined : { published: true },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Error al obtener proyectos' },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo proyecto
export async function POST(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

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

    const project = await db.project.create({
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

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Error al crear proyecto: ${error.message}`
            : 'Error al crear proyecto',
      },
      { status: 500 }
    )
  }
}
