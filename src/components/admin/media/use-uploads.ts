'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaAssetDTO } from '../types'
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT, readImageDimensions, uploadMediaFile } from './media-api'

export type UploadItem = {
  key: string
  name: string
  size: number
  progress: number
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
  asset?: MediaAssetDTO
}

const CONCURRENCY = 3
const ALLOWED = new Set(UPLOAD_ACCEPT.all.split(','))

/** Las fotos HEIC del iPhone se convierten a JPEG si el navegador sabe decodificarlas (Safari). */
async function normalizeFile(file: File): Promise<File> {
  const isHeic = /^image\/hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
  if (!isHeic || typeof createImageBitmap !== 'function') return file

  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    return blob ? new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}

export function useUploads(onUploaded: (asset: MediaAssetDTO) => void) {
  const [items, setItems] = useState<UploadItem[]>([])
  const callback = useRef(onUploaded)

  useEffect(() => {
    callback.current = onUploaded
  })

  const patch = useCallback((key: string, update: Partial<UploadItem>) => {
    setItems((previous) => previous.map((item) => (item.key === key ? { ...item, ...update } : item)))
  }, [])

  const upload = useCallback(
    async (files: File[]) => {
      const entries = files.map((file) => ({ key: crypto.randomUUID(), file }))
      if (entries.length === 0) return []

      setItems((previous) => [
        ...entries.map<UploadItem>(({ key, file }) => ({ key, name: file.name, size: file.size, progress: 0, status: 'queued' })),
        ...previous,
      ])

      const uploaded: MediaAssetDTO[] = []
      let cursor = 0

      const worker = async () => {
        while (cursor < entries.length) {
          const { key, file: original } = entries[cursor++]
          const file = await normalizeFile(original)

          if (!ALLOWED.has(file.type)) {
            patch(key, { status: 'error', error: 'Formato no permitido (usa JPG, PNG, WebP, AVIF, GIF, MP4, WebM, MOV o PDF)' })
            continue
          }

          if (file.size > MAX_UPLOAD_BYTES) {
            patch(key, { status: 'error', error: 'Supera el límite de 95 MB' })
            continue
          }

          patch(key, { status: 'uploading' })

          try {
            const size = await readImageDimensions(file)
            const asset = await uploadMediaFile(file, file.name, { width: size?.width, height: size?.height }, (progress) =>
              patch(key, { progress }),
            )
            patch(key, { status: 'done', progress: 1, asset })
            uploaded.push(asset)
            callback.current(asset)
          } catch (error) {
            patch(key, { status: 'error', error: error instanceof Error ? error.message : 'Error al subir' })
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker))
      return uploaded
    },
    [patch],
  )

  const clearFinished = useCallback(() => {
    setItems((previous) => previous.filter((item) => item.status === 'queued' || item.status === 'uploading'))
  }, [])

  const dismiss = useCallback((key: string) => {
    setItems((previous) => previous.filter((item) => item.key !== key))
  }, [])

  return { items, upload, clearFinished, dismiss, busy: items.some((item) => item.status === 'queued' || item.status === 'uploading') }
}
