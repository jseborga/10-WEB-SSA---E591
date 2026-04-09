import { NextResponse } from 'next/server'
import { isAdminAuthenticated, requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { ensureUniquePublicationSlug, normalizeSeoKeywords, slugifyPublicationValue } from '@/lib/publications'

function parseMenuOrder(value: unknown) {
  return typeof value === 'number' ? value : parseInt(String(value ?? ''), 10) || 0
}

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
      orderBy: menuOnly ? [{ menuOrder: 'asc' }, { createdAt: 'asc' }] : [{ createdAt: 'desc' }],
    })

    return NextResponse.json(publications)
  } catch (error) {
    console.error('Error fetching publications:', error)
    return NextResponse.json({ error: 'Error al obtener publicaciones' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''

    if (!title) {
      return NextResponse.json({ error: 'El titulo es obligatorio' }, { status: 400 })
    }

    const slug = await ensureUniquePublicationSlug(body.slug || title)

    const publication = await db.publication.create({
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

    return NextResponse.json(publication, { status: 201 })
  } catch (error) {
    console.error('Error creating publication:', error)
    if (error instanceof Error && error.message.toLowerCase().includes('unique constraint')) {
      return NextResponse.json(
        { error: 'Ya existe una pagina con ese slug. Cambia el titulo o el slug.' },
        { status: 409 },
      )
    }

    return NextResponse.json({ error: 'Error al crear publicacion' }, { status: 500 })
  }
}
