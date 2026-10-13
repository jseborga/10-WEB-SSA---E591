import { NextResponse } from 'next/server'
import { getSessionFromRequest, requireAuthenticatedUser } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { UPLOADABLE_CONTENT_TYPES, createStoredFileName, getMediaUrl, saveUploadedFile } from '@/lib/media-storage'

const MAX_FILE_SIZE = 95 * 1024 * 1024

function readOptionalInt(value: FormDataEntryValue | null) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function readOptionalText(value: FormDataEntryValue | null, maxLength = 500) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null
}

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAuthenticatedUser(request)

    if (unauthorized) {
      return unauthorized
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo inválido' }, { status: 400 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el límite de 95 MB' }, { status: 400 })
    }

    const contentType = (file.type || '').toLowerCase()

    if (!UPLOADABLE_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: 'Formato no permitido. Usa JPG, PNG, WebP, AVIF, GIF, MP4, WebM, MOV o PDF.' },
        { status: 400 },
      )
    }

    const storedFileName = createStoredFileName(file.name, contentType)
    await saveUploadedFile(storedFileName, file.stream(), contentType)
    const url = getMediaUrl(storedFileName)
    const session = getSessionFromRequest(request)

    const asset = await db.mediaAsset.create({
      data: {
        source: readOptionalText(formData.get('source'), 40) || 'manual',
        kind: contentType.startsWith('video/') ? 'video' : contentType === 'application/pdf' ? 'document' : 'image',
        fileName: storedFileName,
        originalName: file.name.slice(0, 200),
        mimeType: contentType,
        size: file.size,
        url,
        storagePath: storedFileName,
        alt: readOptionalText(formData.get('alt')),
        width: readOptionalInt(formData.get('width')),
        height: readOptionalInt(formData.get('height')),
        parentId: readOptionalText(formData.get('parentId'), 64),
        editRecipe: readOptionalText(formData.get('editRecipe'), 4000),
        metadata: session ? JSON.stringify({ uploadedBy: session.username }) : null,
      },
    })

    return NextResponse.json({
      success: true,
      id: asset.id,
      fileName: storedFileName,
      originalName: file.name,
      url,
      contentType,
      size: file.size,
    })
  } catch (error) {
    console.error('Error uploading media:', error)
    return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 500 })
  }
}
