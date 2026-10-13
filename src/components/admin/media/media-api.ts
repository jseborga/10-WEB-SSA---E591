'use client'

import type { MediaAssetDTO } from '../types'

export type MediaFilter = 'all' | 'image' | 'video' | 'document' | 'ai'

export type MediaCounts = Record<MediaFilter, number>

export type MediaPage = { items: MediaAssetDTO[]; nextCursor: string | null; counts?: MediaCounts }

/** Tipos que acepta /api/media/upload (reflejo de UPLOADABLE_CONTENT_TYPES). */
export const UPLOAD_ACCEPT: Record<'image' | 'video' | 'all', string> = {
  image: 'image/jpeg,image/png,image/webp,image/avif,image/gif',
  video: 'video/mp4,video/webm,video/quicktime,video/x-m4v',
  all: 'image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime,video/x-m4v,application/pdf',
}

export const MAX_UPLOAD_BYTES = 95 * 1024 * 1024

export type MediaDetail = {
  asset: MediaAssetDTO
  editRecipe: string | null
  parent: MediaAssetDTO | null
  children: MediaAssetDTO[]
}

export class MediaApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { credentials: 'same-origin', ...init })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = (data && typeof data.error === 'string' && data.error) || `Error ${response.status}`
    throw new MediaApiError(message, response.status)
  }

  return data as T
}

export function fetchMediaPage(params: {
  q?: string
  filter?: MediaFilter
  cursor?: string | null
  limit?: number
  withCounts?: boolean
}) {
  const search = new URLSearchParams()
  if (params.withCounts) search.set('withCounts', '1')
  if (params.q) search.set('q', params.q)
  if (params.filter === 'ai') search.set('source', 'ai')
  else if (params.filter && params.filter !== 'all') search.set('kind', params.filter)
  if (params.cursor) search.set('cursor', params.cursor)
  search.set('limit', String(params.limit ?? 40))
  return request<MediaPage>(`/api/admin/media?${search.toString()}`)
}

export function fetchMediaDetail(id: string) {
  return request<MediaDetail>(`/api/admin/media/${encodeURIComponent(id)}`)
}

export function updateMediaAsset(id: string, data: { alt?: string | null; originalName?: string }) {
  return request<MediaAssetDTO>(`/api/admin/media/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteMediaAsset(id: string) {
  return request<{ success: boolean }>(`/api/admin/media/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function reindexMedia() {
  return request<{ created: number; total: number; remaining: number }>('/api/admin/media/reindex', { method: 'POST' })
}

export function enhanceWithAi(body: { assetId: string; preset?: string; prompt?: string }) {
  return request<{ asset: MediaAssetDTO; model: string }>('/api/ai/image-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Sube un archivo con progreso (XHR) y devuelve el DTO completo del recurso creado. */
export function uploadMediaFile(
  file: File | Blob,
  fileName: string,
  fields: Record<string, string | number | null | undefined>,
  onProgress?: (fraction: number) => void,
) {
  return new Promise<MediaAssetDTO>((resolve, reject) => {
    const form = new FormData()
    form.append('file', file, fileName)
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== undefined && value !== '') form.append(key, String(value))
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/media/upload')
    xhr.responseType = 'json'
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onerror = () => reject(new MediaApiError('Error de red al subir el archivo', 0))
    xhr.onload = () => {
      const data = xhr.response as { id?: string; error?: string } | null
      if (xhr.status < 200 || xhr.status >= 300 || !data?.id) {
        reject(new MediaApiError(data?.error || `Error ${xhr.status}`, xhr.status))
        return
      }
      onProgress?.(1)
      fetchMediaDetail(data.id).then((detail) => resolve(detail.asset), reject)
    }
    xhr.send(form)
  })
}

/** Lee ancho/alto en el navegador para guardarlos junto al archivo. */
export async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return null

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file)
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return size
    }
  } catch {}

  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => resolve(null)
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`
}

export function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  telegram: 'Telegram',
  ai: 'IA',
  editor: 'Editor',
  import: 'Importado',
  library: 'Importado',
  social: 'Redes',
  instagram: 'Redes',
  facebook: 'Redes',
}

export function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source.charAt(0).toUpperCase() + source.slice(1)
}

export function sourceBadgeClass(source: string) {
  switch (source) {
    case 'ai':
      return 'border-violet-200 bg-violet-50 text-violet-700'
    case 'editor':
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'telegram':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700'
    case 'social':
    case 'instagram':
    case 'facebook':
      return 'border-pink-200 bg-pink-50 text-pink-700'
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-600'
  }
}

export function displayName(asset: MediaAssetDTO) {
  return asset.originalName || asset.fileName
}
