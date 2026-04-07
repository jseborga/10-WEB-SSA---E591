import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

// GET - Obtener todos los proyectos
export async function GET() {
  try {
    const projects = await db.project.findMany({
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
    const unauthorized = requireAdmin(request)

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
      client,
      status,
    } = body

    const project = await db.project.create({
      data: {
        title,
        description,
        fullDescription,
        category,
        location,
        year: year ? parseInt(year) : null,
        area,
        featured: featured || false,
        mainImage: mainImage || body.images || null,
        gallery: gallery || null,
        client: client || null,
        status: status || null,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json(
      { error: 'Error al crear proyecto' },
      { status: 500 }
    )
  }
}
