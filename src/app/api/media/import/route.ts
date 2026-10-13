import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { UPLOADABLE_CONTENT_TYPES, createStoredFileName, getMediaUrl, saveUploadedFile, toMediaKey } from '@/lib/media-storage'
import { safeFetch } from '@/lib/safe-fetch'

const MAX_FILE_SIZE = 95 * 1024 * 1024

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-m4v': '.m4v',
}

function normalizeHttpUrl(value: unknown) {
  if (typeof value !== 'string') return ''

  const trimmed = value.trim()
  if (!trimmed) return ''

  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return ''
    }
    return parsed.toString()
  } catch {
    return ''
  }
}

function guessOriginalName(sourceUrl: string, contentType: string | null) {
  const parsed = new URL(sourceUrl)
  const baseName = toMediaKey(decodeURIComponent(parsed.pathname || '')).trim()
  const extension = contentType ? EXTENSION_BY_CONTENT_TYPE[contentType.toLowerCase()] || '' : ''

  if (baseName) {
    return baseName.includes('.') ? baseName : `${baseName}${extension}`
  }

  return `remote-media${extension}`
}

function isAllowedContentType(contentType: string | null) {
  if (!contentType) return false
  return UPLOADABLE_CONTENT_TYPES.has(contentType.toLowerCase()) && contentType !== 'application/pdf'
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const body = (await request.json().catch(() => ({}))) as { url?: unknown; urls?: unknown }
    const candidates = Array.isArray(body.urls) ? body.urls : [body.url]
    const urls = Array.from(
      new Set(
        candidates
          .map((value) => normalizeHttpUrl(value))
          .filter((value): value is string => Boolean(value)),
      ),
    )

    if (urls.length === 0) {
      return NextResponse.json({ error: 'Debes indicar al menos una URL http(s) válida.' }, { status: 400 })
    }

    const items: Array<{
      sourceUrl: string
      url: string
      fileName: string
      contentType: string | null
      size: number
    }> = []

    for (const sourceUrl of urls) {
      const response = await safeFetch(sourceUrl, {
        headers: {
          'user-agent': 'SSA-Ingenieria-MediaImporter/1.0',
        },
      })

      if (!response.ok) {
        throw new Error(`No se pudo descargar ${sourceUrl}`)
      }

      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || null
      const contentLength = Number(response.headers.get('content-length') || '0')

      if (!isAllowedContentType(contentType)) {
        throw new Error(`El enlace no apunta a una imagen o video permitido: ${sourceUrl}`)
      }

      if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE) {
        throw new Error(`El archivo supera el límite de ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB`)
      }

      const finalUrl = response.url || sourceUrl
      const originalName = guessOriginalName(finalUrl, contentType)
      const storedFileName = createStoredFileName(originalName, contentType)
      const buffer = new Uint8Array(await response.arrayBuffer())

      if (buffer.byteLength <= 0) {
        throw new Error(`El archivo descargado está vacío: ${sourceUrl}`)
      }

      if (buffer.byteLength > MAX_FILE_SIZE) {
        throw new Error(`El archivo supera el límite de ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB`)
      }

      await saveUploadedFile(storedFileName, buffer, contentType)
      const url = getMediaUrl(storedFileName)

      await db.mediaAsset.create({
        data: {
          source: 'import',
          kind: contentType?.startsWith('video/') ? 'video' : 'image',
          fileName: storedFileName,
          originalName: originalName.slice(0, 200),
          mimeType: contentType,
          size: buffer.byteLength,
          url,
          storagePath: storedFileName,
          metadata: JSON.stringify({ sourceUrl }),
        },
      })

      items.push({
        sourceUrl,
        url,
        fileName: storedFileName,
        contentType,
        size: buffer.byteLength,
      })
    }

    return NextResponse.json({
      success: true,
      items,
    })
  } catch (error) {
    console.error('Error importing remote media:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo importar el medio remoto' },
      { status: 500 },
    )
  }
}
