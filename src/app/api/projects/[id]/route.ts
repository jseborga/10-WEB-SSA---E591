import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'

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
    const unauthorized = requireAdmin(request)

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
      client,
      status,
    } = body

    const project = await db.project.update({
      where: { id },
      data: {
        title,
        description,
        fullDescription,
        category,
        location,
        year: year ? parseInt(year) : null,
        area,
        featured,
        mainImage: mainImage || body.images || null,
        gallery: gallery || null,
        client: client || null,
        status: status || null,
      },
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json(
      { error: 'Error al actualizar proyecto' },
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
    const unauthorized = requireAdmin(request)

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
