import { NextResponse } from 'next/server'
import { getContentType, readStoredFile } from '@/lib/media-storage'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params
    const data = await readStoredFile(fileName)

    return new NextResponse(data, {
      headers: {
        'Content-Type': getContentType(fileName),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving media:', error)
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }
}
