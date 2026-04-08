import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { parseStoredJson } from '@/lib/automation-log'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const reviews = await db.approvalItem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 120,
    })

    const mediaAssetIds = Array.from(
      new Set(
        reviews.flatMap((review) => {
          const payload = parseStoredJson<Record<string, unknown>>(review.payload, {})
          const rawIds = payload.mediaAssetIds
          return Array.isArray(rawIds) ? rawIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
        }),
      ),
    )

    const assets = mediaAssetIds.length
      ? await db.mediaAsset.findMany({
          where: { id: { in: mediaAssetIds } },
          select: {
            id: true,
            url: true,
            kind: true,
            fileName: true,
          },
        })
      : []

    const assetMap = new Map(assets.map((asset) => [asset.id, asset]))

    const enrichedReviews = reviews.map((review) => {
      const payload = parseStoredJson<Record<string, unknown>>(review.payload, {})
      const rawIds = Array.isArray(payload.mediaAssetIds) ? payload.mediaAssetIds : []
      const previewAssets = rawIds
        .map((assetId) => (typeof assetId === 'string' ? assetMap.get(assetId) : null))
        .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))

      return {
        ...review,
        previewAssets,
      }
    })

    return NextResponse.json(enrichedReviews)
  } catch (error) {
    console.error('Error loading reviews:', error)
    return NextResponse.json({ error: 'No se pudieron cargar las revisiones' }, { status: 500 })
  }
}
