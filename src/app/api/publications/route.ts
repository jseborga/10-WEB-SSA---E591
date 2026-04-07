import { NextResponse } from 'next/server'
import { isAdminAuthenticated, requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'

// GET - Obtener todas las publicaciones
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const isAdmin = isAdminAuthenticated(request)
    const publishedOnly = isAdmin ? searchParams.get('published') === 'true' : true
    const menuOnly = searchParams.get('menu') === 'true'
    
    const publications = await db.publication.findMany({
      where: {
        ...(publishedOnly ? { published: true } : {}),
        ...(menuOnly ? { showInMenu: true } : {}),
      },
      orderBy: menuOnly ? [{ menuOrder: 'asc' }, { createdAt: 'asc' }] : [{ createdAt: 'desc' }]
    })
    
    return NextResponse.json(publications)
  } catch (error) {
    console.error('Error fetching publications:', error)
    return NextResponse.json(
      { error: 'Error al obtener publicaciones' },
      { status: 500 }
    )
  }
}

// POST - Crear nueva publicación
export async function POST(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json()
    const { title, slug, excerpt, content, image, published, category, showInMenu, menuOrder } = body

    const publication = await db.publication.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        image,
        published: published || false,
        category,
        showInMenu: showInMenu || false,
        menuOrder: typeof menuOrder === 'number' ? menuOrder : parseInt(menuOrder, 10) || 0,
      }
    })

    return NextResponse.json(publication, { status: 201 })
  } catch (error) {
    console.error('Error creating publication:', error)
    return NextResponse.json(
      { error: 'Error al crear publicación' },
      { status: 500 }
    )
  }
}
