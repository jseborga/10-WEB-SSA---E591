import type { MediaAssetDTO, MediaKind } from '@/components/admin/types'

/** Fila mínima de MediaAsset que necesita el mapper (evita depender del tipo generado). */
export type MediaAssetRow = {
  id: string
  url: string
  fileName: string
  originalName: string | null
  kind: string
  mimeType: string | null
  size: number | null
  width: number | null
  height: number | null
  alt: string | null
  source: string
  parentId: string | null
  createdAt: Date | string
}

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|svg)$/i

/** Deduce el tipo a partir del content-type o, si falta, de la extensión. */
export function inferMediaKind(mimeType: string | null | undefined, fileName = ''): MediaKind {
  const type = (mimeType || '').toLowerCase()

  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type && type !== 'application/octet-stream') return 'document'
  if (IMAGE_EXTENSIONS.test(fileName)) return 'image'
  if (VIDEO_EXTENSIONS.test(fileName)) return 'video'
  return 'document'
}

export function normalizeMediaKind(kind: string | null | undefined, mimeType?: string | null, fileName?: string): MediaKind {
  const value = (kind || '').toLowerCase()

  if (value === 'image' || value === 'photo') return 'image'
  if (value === 'video' || value === 'animation') return 'video'
  if (value === 'document') return 'document'
  return inferMediaKind(mimeType, fileName)
}

export function toMediaAssetDTO(row: MediaAssetRow): MediaAssetDTO {
  return {
    id: row.id,
    url: row.url,
    fileName: row.fileName,
    originalName: row.originalName,
    kind: normalizeMediaKind(row.kind, row.mimeType, row.fileName),
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    source: row.source,
    parentId: row.parentId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  }
}
