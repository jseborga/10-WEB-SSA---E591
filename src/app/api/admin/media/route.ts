import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { normalizeMediaKind, toMediaAssetDTO } from '@/lib/media-assets'

const KINDS = new Set(['image', 'video', 'document'])

export async function GET(request: Request) {
  const unauthorized = await requireAuthenticatedUser(request)
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim().slice(0, 120)
    const kind = (searchParams.get('kind') || 'all').trim()
    const source = (searchParams.get('source') || '').trim().slice(0, 40)
    const cursor = (searchParams.get('cursor') || '').trim()
    const limitParam = Number.parseInt(searchParams.get('limit') || '', 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 40

    const where: Record<string, unknown> = {}

    if (KINDS.has(kind)) {
      where.kind = kind
    }

    if (source) {
      where.source = source
    }

    if (q) {
      where.OR = [{ originalName: { contains: q } }, { alt: { contains: q } }, { fileName: { contains: q } }]
    }

    const rows = await db.mediaAsset.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toMediaAssetDTO)

    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null

    // Recuentos opcionales para la cabecera de la biblioteca (solo en la primera página).
    if (searchParams.get('withCounts') === '1' && !cursor) {
      const [byKind, ai] = await Promise.all([
        db.mediaAsset.groupBy({ by: ['kind'], _count: { _all: true } }),
        db.mediaAsset.count({ where: { source: 'ai' } }),
      ])
      const counts = { all: 0, image: 0, video: 0, document: 0, ai }

      for (const group of byKind) {
        const key = normalizeMediaKind(group.kind)
        counts[key] += group._count._all
        counts.all += group._count._all
      }

      return NextResponse.json({ items, nextCursor, counts })
    }

    return NextResponse.json({ items, nextCursor })
  } catch (error) {
    console.error('Error listing media:', error)
    return NextResponse.json({ error: 'No se pudo cargar la biblioteca' }, { status: 500 })
  }
}
