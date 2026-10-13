import { NextResponse } from 'next/server'
import type { Prisma } from '@/lib/db'
import { isAdminAuthenticated, requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import {
  MANAGED_PUBLICATION_SLUGS,
  buildPublicationWriteData,
  ensureUniquePublicationSlug,
  normalizePublicationSource,
  toPublicationDTO,
} from '@/lib/publications'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const isAdmin = isAdminAuthenticated(request)
    const status = searchParams.get('status')
    // Compatibilidad: ?published=true del panel antiguo.
    const statusFilter = !isAdmin
      ? 'published'
      : status === 'draft' || status === 'published'
        ? status
        : searchParams.get('published') === 'true'
          ? 'published'
          : 'all'
    const menuOnly = searchParams.get('menu') === 'true'
    const q = (searchParams.get('q') || '').trim().slice(0, 120)
    const source = searchParams.get('source')
    const kind = searchParams.get('kind')

    const and: Prisma.PublicationWhereInput[] = []

    if (statusFilter === 'published') and.push({ published: true })
    if (statusFilter === 'draft') and.push({ published: false })
    if (menuOnly) and.push({ showInMenu: true })
    if (source) and.push({ source: normalizePublicationSource(source) })

    if (kind === 'page') {
      and.push({ OR: [{ showInMenu: true }, { slug: { in: MANAGED_PUBLICATION_SLUGS } }] })
    } else if (kind === 'post') {
      and.push({ showInMenu: false, slug: { notIn: MANAGED_PUBLICATION_SLUGS } })
    }

    if (q) {
      and.push({
        OR: [{ title: { contains: q } }, { excerpt: { contains: q } }, { slug: { contains: q } }, { category: { contains: q } }],
      })
    }

    const publications = await db.publication.findMany({
      where: and.length > 0 ? { AND: and } : {},
      orderBy: menuOnly ? [{ menuOrder: 'asc' }, { createdAt: 'asc' }] : [{ createdAt: 'desc' }],
    })

    return NextResponse.json(publications.map(toPublicationDTO))
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : ''

    if (!title) {
      return NextResponse.json({ error: 'El titulo es obligatorio' }, { status: 400 })
    }

    const slug = await ensureUniquePublicationSlug(typeof body.slug === 'string' && body.slug.trim() ? body.slug : title)
    const data = buildPublicationWriteData(body)

    // Fecha de publicación: la primera vez que se publica.
    if (data.published && !data.publishedAt) {
      data.publishedAt = new Date()
    }

    const publication = await db.publication.create({
      data: { ...data, title, slug } as Prisma.PublicationCreateInput,
    })

    return NextResponse.json(toPublicationDTO(publication), { status: 201 })
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
