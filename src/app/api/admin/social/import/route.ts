import { NextResponse } from 'next/server'
import type { SocialImportResult, SocialNetwork, SocialPostMedia } from '@/components/admin/types'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { UPLOADABLE_CONTENT_TYPES, createStoredFileName, getMediaUrl, saveUploadedFile } from '@/lib/media-storage'
import {
  META_PROVIDER,
  MetaGraphError,
  assertConnected,
  buildCopyFromCaption,
  getMetaConnection,
  getSocialPost,
} from '@/lib/meta-graph'
import { ensureUniquePublicationSlug } from '@/lib/publications'
import { safeFetch } from '@/lib/safe-fetch'

const MAX_POSTS_PER_REQUEST = 12
const MAX_FILE_SIZE = 95 * 1024 * 1024

/** Error de un archivo puntual: se omite ese archivo y se sigue con el resto. */
class SkippableMediaError extends Error {}

type StoredMedia = { url: string; kind: 'image' | 'video' }

function guessContentType(header: string | null, expected: 'image' | 'video') {
  const type = (header || '').split(';')[0].trim().toLowerCase()

  if (UPLOADABLE_CONTENT_TYPES.has(type) && type !== 'application/pdf') {
    return type
  }

  // Los CDN de Meta a veces responden application/octet-stream.
  if (!type || type === 'application/octet-stream' || type === 'binary/octet-stream') {
    return expected === 'video' ? 'video/mp4' : 'image/jpeg'
  }

  throw new SkippableMediaError(`Tipo de archivo no permitido (${type})`)
}

/** Descarga un medio de Meta, lo guarda en R2 y crea su fila MediaAsset. */
async function storeRemoteMedia(
  sourceUrl: string,
  expected: 'image' | 'video',
  network: SocialNetwork,
  context: { postId: string; permalink: string | null; caption: string },
): Promise<StoredMedia> {
  const response = await safeFetch(sourceUrl, { headers: { 'user-agent': 'SSA-Ingenieria-SocialImporter/1.0' } })

  if (!response.ok) {
    throw new SkippableMediaError(`No se pudo descargar el archivo (HTTP ${response.status})`)
  }

  const contentType = guessContentType(response.headers.get('content-type'), expected)
  const declaredLength = Number(response.headers.get('content-length') || '0')

  if (Number.isFinite(declaredLength) && declaredLength > MAX_FILE_SIZE) {
    await response.body?.cancel().catch(() => undefined)
    throw new SkippableMediaError('El archivo supera el límite de 95 MB')
  }

  const kind: 'image' | 'video' = contentType.startsWith('video/') ? 'video' : 'image'
  const storedFileName = createStoredFileName(`${network}-${context.postId}`, contentType)
  let size: number

  if (kind === 'video' && declaredLength > 0 && response.body && typeof FixedLengthStream === 'function') {
    // Videos: se transmiten directo a R2 sin cargarlos completos en memoria.
    const { readable, writable } = new FixedLengthStream(declaredLength)
    const pipe = response.body.pipeTo(writable)
    await Promise.all([saveUploadedFile(storedFileName, readable as unknown as ReadableStream, contentType), pipe])
    size = declaredLength
  } else {
    const buffer = new Uint8Array(await response.arrayBuffer())

    if (buffer.byteLength <= 0) {
      throw new SkippableMediaError('El archivo descargado está vacío')
    }

    if (buffer.byteLength > MAX_FILE_SIZE) {
      throw new SkippableMediaError('El archivo supera el límite de 95 MB')
    }

    await saveUploadedFile(storedFileName, buffer, contentType)
    size = buffer.byteLength
  }

  const url = getMediaUrl(storedFileName)

  await db.mediaAsset.create({
    data: {
      source: network,
      kind,
      fileName: storedFileName,
      originalName: `${network}-${context.postId}`.slice(0, 200),
      mimeType: contentType,
      size,
      url,
      storagePath: storedFileName,
      alt: context.caption ? context.caption.replace(/\s+/g, ' ').slice(0, 200) : null,
      metadata: JSON.stringify({ network, postId: context.postId, permalink: context.permalink }),
    },
  })

  return { url, kind }
}

function readIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === 'string' && /^[0-9_]{3,80}$/.test(item.trim())).map((item) => item.trim())),
  )
}

export async function POST(request: Request) {
  const unauthorized = await requireAuthenticatedUser(request)
  if (unauthorized) return unauthorized

  const body = (await request.json().catch(() => ({}))) as { network?: unknown; ids?: unknown; publish?: unknown }
  const network: SocialNetwork | null = body.network === 'instagram' || body.network === 'facebook' ? body.network : null
  const ids = readIds(body.ids)
  const publish = body.publish === true

  if (!network) {
    return NextResponse.json({ error: 'Indica la red: instagram o facebook.' }, { status: 400 })
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: 'Selecciona al menos una publicación.' }, { status: 400 })
  }

  if (ids.length > MAX_POSTS_PER_REQUEST) {
    return NextResponse.json({ error: `Máximo ${MAX_POSTS_PER_REQUEST} publicaciones por solicitud.` }, { status: 400 })
  }

  let connection

  try {
    connection = assertConnected(await getMetaConnection())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No hay conexión con Meta'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const result: SocialImportResult = { imported: [], skipped: [], errors: [] }

  const existing = await db.publication.findMany({
    where: { source: network, externalId: { in: ids } },
    select: { id: true, externalId: true },
  })
  const existingByExternalId = new Map(existing.map((row) => [row.externalId, row.id]))

  // Secuencial: D1 no tiene transacciones interactivas y así se limita el uso de memoria.
  for (const id of ids) {
    const existingId = existingByExternalId.get(id)

    if (existingId) {
      result.skipped.push({ id, reason: 'Ya importada', publicationId: existingId })
      continue
    }

    // Los posts de Facebook tienen la forma <pageId>_<postId>: se evita importar posts de otras páginas.
    if (network === 'facebook' && !id.startsWith(`${connection.pageId}_`)) {
      result.errors.push({ id, error: 'El post no pertenece a la página conectada.' })
      continue
    }

    try {
      const post = await getSocialPost(connection, network, id)
      const context = { postId: post.id, permalink: post.permalink, caption: post.caption }
      const gallery: string[] = []
      let videoCover: string | null = null
      const warnings: string[] = []

      for (const item of post.media as SocialPostMedia[]) {
        try {
          if (item.type === 'video') {
            // Miniatura del video: sirve de portada si el post no tiene fotos.
            if (item.thumbnailUrl && !videoCover) {
              const thumb = await storeRemoteMedia(item.thumbnailUrl, 'image', network, context).catch(() => null)
              videoCover = thumb?.url || null
            }
          }

          const stored = await storeRemoteMedia(item.url, item.type, network, context)
          gallery.push(stored.url)
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : 'Archivo omitido')
        }
      }

      if (post.media.length > 0 && gallery.length === 0 && !videoCover) {
        throw new Error(`No se pudo descargar ningún archivo del post (${Array.from(new Set(warnings)).join('; ')})`)
      }

      const image = gallery.find((url) => !/\.(mp4|webm|mov|m4v)$/i.test(url)) || videoCover

      const copy = buildCopyFromCaption(post.caption, network, post.timestamp)
      const slug = await ensureUniquePublicationSlug(copy.title)
      const timestamp = post.timestamp ? new Date(post.timestamp) : null

      const publication = await db.publication.create({
        data: {
          title: copy.title,
          slug,
          excerpt: copy.excerpt,
          content: copy.content,
          image,
          gallery: gallery.length > 0 ? JSON.stringify(gallery) : null,
          source: network,
          externalId: post.id,
          externalUrl: post.permalink && /^https?:\/\//i.test(post.permalink) ? post.permalink : null,
          published: publish,
          publishedAt: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : publish ? new Date() : null,
          category: 'redes',
          showInMenu: false,
          menuOrder: 0,
        },
      })

      result.imported.push({ id, publicationId: publication.id })

      if (warnings.length > 0) {
        result.errors.push({ id, error: `Importada con avisos: ${Array.from(new Set(warnings)).join('; ')}` })
      }
    } catch (error) {
      const message =
        error instanceof MetaGraphError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Error desconocido'
      result.errors.push({ id, error: message })
    }
  }

  const fatalErrors = result.errors.filter((entry) => !entry.error.startsWith('Importada con avisos'))

  await db.socialConnection
    .update({
      where: { provider: META_PROVIDER },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: fatalErrors.length > 0 ? fatalErrors.map((entry) => entry.error).join(' | ').slice(0, 1000) : null,
      },
    })
    .catch(() => undefined)

  return NextResponse.json(result)
}
