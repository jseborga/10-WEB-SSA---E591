import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { inferMediaKind } from '@/lib/media-assets'
import { getContentType, getMediaUrl, listStoredFiles } from '@/lib/media-storage'

// Tope por llamada para no agotar los subrequests del Worker; el cliente repite si queda algo.
const MAX_CREATES_PER_CALL = 400
const PARALLEL = 8

/** Crea filas MediaAsset para objetos de R2 que llegaron sin registro (migración del servidor anterior). */
export async function POST(request: Request) {
  const unauthorized = await requireAuthenticatedUser(request)
  if (unauthorized) return unauthorized

  try {
    const known = new Set(
      (await db.mediaAsset.findMany({ select: { fileName: true, storagePath: true } })).flatMap((row) =>
        [row.fileName, row.storagePath].filter((value): value is string => Boolean(value)),
      ),
    )

    const missing: Array<{ key: string; size: number; uploaded: Date }> = []
    let total = 0
    let cursor: string | undefined

    do {
      const page = await listStoredFiles(cursor, 1000)

      for (const object of page.objects) {
        // Claves internas o con subcarpetas: no se sirven por /api/media/<clave>.
        if (object.key.startsWith('_') || object.key.includes('/')) continue
        total += 1
        if (!known.has(object.key)) missing.push({ key: object.key, size: object.size, uploaded: object.uploaded })
      }

      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)

    const batch = missing.slice(0, MAX_CREATES_PER_CALL)
    let created = 0

    for (let index = 0; index < batch.length; index += PARALLEL) {
      const results = await Promise.allSettled(
        batch.slice(index, index + PARALLEL).map((object) => {
          const mimeType = getContentType(object.key)

          return db.mediaAsset.create({
            data: {
              source: 'library',
              kind: inferMediaKind(mimeType, object.key),
              fileName: object.key,
              originalName: object.key.slice(0, 200),
              mimeType: mimeType === 'application/octet-stream' ? null : mimeType,
              size: object.size,
              url: getMediaUrl(object.key),
              storagePath: object.key,
              createdAt: object.uploaded,
            },
          })
        }),
      )
      created += results.filter((result) => result.status === 'fulfilled').length
    }

    return NextResponse.json({ created, total, remaining: Math.max(missing.length - created, 0) })
  } catch (error) {
    console.error('Error reindexing media:', error)
    return NextResponse.json({ error: 'No se pudo sincronizar la biblioteca' }, { status: 500 })
  }
}
