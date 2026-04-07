import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createStoredFileName, saveUploadedFile } from '@/lib/media-storage'

const MAX_FILE_SIZE = 80 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const unauthorized = requireAdmin(request)

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
      return NextResponse.json({ error: 'El archivo supera el límite de 80 MB' }, { status: 400 })
    }

    const storedFileName = createStoredFileName(file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    await saveUploadedFile(storedFileName, buffer)

    return NextResponse.json({
      success: true,
      fileName: storedFileName,
      originalName: file.name,
      url: `/api/media/${storedFileName}`,
      contentType: file.type || null,
      size: file.size,
    })
  } catch (error) {
    console.error('Error uploading media:', error)
    return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 500 })
  }
}
