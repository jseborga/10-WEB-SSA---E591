import { getEnv } from '@/lib/cloudflare'

/**
 * Almacenamiento de medios en Cloudflare R2.
 * Las claves del bucket son nombres de archivo planos y se sirven en /api/media/<clave>,
 * así las URLs guardadas antes de la migración siguen funcionando.
 */

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.pdf': 'application/pdf',
}

/** Tipos que se aceptan al subir. SVG queda fuera: puede contener scripts. */
export const UPLOADABLE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'application/pdf',
])

const EXTENSION_BY_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(CONTENT_TYPES).map(([ext, type]) => [type, ext]),
)
EXTENSION_BY_TYPE['image/jpeg'] = '.jpg'

function getBucket() {
  const bucket = getEnv().MEDIA

  if (!bucket) {
    throw new Error('Binding R2 "MEDIA" no configurado en wrangler.jsonc.')
  }

  return bucket
}

function getExtension(fileName: string) {
  const match = /\.[a-z0-9]+$/i.exec(fileName)
  return match ? match[0].toLowerCase() : ''
}

/** Equivalente a path.basename: impide claves con rutas. */
export function toMediaKey(fileName: string) {
  return fileName.split(/[\\/]/).filter(Boolean).pop() ?? ''
}

export function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/-+/g, '-')
}

export function createStoredFileName(originalName: string, contentType?: string | null) {
  const safe = sanitizeFileName(toMediaKey(originalName))
  let ext = getExtension(safe)
  const base = (ext ? safe.slice(0, -ext.length) : safe).replace(/^[.-]+|[.-]+$/g, '').slice(0, 60) || 'media'

  if (!ext && contentType && EXTENSION_BY_TYPE[contentType]) {
    ext = EXTENSION_BY_TYPE[contentType]
  }

  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}${ext}`
}

export function getContentType(fileName: string) {
  return CONTENT_TYPES[getExtension(fileName)] || 'application/octet-stream'
}

export function getMediaUrl(fileName: string) {
  return `/api/media/${encodeURIComponent(toMediaKey(fileName))}`
}

/** Extrae la clave R2 de una URL /api/media/<clave> (absoluta o relativa). */
export function getMediaKeyFromUrl(sourceUrl: string | null | undefined) {
  if (!sourceUrl) {
    return null
  }

  try {
    const parsed = new URL(sourceUrl, 'http://localhost')
    const parts = parsed.pathname.split('/').filter(Boolean)

    if (parts[0] === 'api' && parts[1] === 'media' && parts[2]) {
      return toMediaKey(decodeURIComponent(parts.slice(2).join('/')))
    }
  } catch {
    return null
  }

  return null
}

export async function saveUploadedFile(
  fileName: string,
  data: ArrayBuffer | ArrayBufferView | ReadableStream | Blob,
  contentType?: string | null,
) {
  const key = toMediaKey(fileName)
  await getBucket().put(key, data as ArrayBuffer, {
    httpMetadata: {
      contentType: contentType || getContentType(key),
      cacheControl: 'public, max-age=31536000, immutable',
    },
  })
  return key
}

export async function readStoredFile(fileName: string) {
  const object = await getBucket().get(toMediaKey(fileName))

  if (!object) {
    throw new Error('Archivo no encontrado')
  }

  return new Uint8Array(await object.arrayBuffer())
}

export async function getStoredObject(fileName: string, options?: R2GetOptions) {
  return getBucket().get(toMediaKey(fileName), options)
}

export async function deleteStoredFile(fileName: string) {
  await getBucket().delete(toMediaKey(fileName))
}

export async function listStoredFiles(cursor?: string, limit = 500) {
  return getBucket().list({ cursor, limit })
}
