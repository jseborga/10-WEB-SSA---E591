import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { appendImportChunk } from '@/lib/backup'

export const dynamic = 'force-dynamic'

const MAX_CHUNK_SIZE = 32 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const url = new URL(request.url)
    const id = url.searchParams.get('id') || ''
    const offset = Number(url.searchParams.get('offset'))

    if (!Number.isFinite(offset) || offset < 0) {
      return NextResponse.json({ error: 'Offset inválido' }, { status: 400 })
    }

    const data = Buffer.from(await request.arrayBuffer())

    if (data.length === 0) {
      return NextResponse.json({ error: 'Fragmento vacío' }, { status: 400 })
    }

    if (data.length > MAX_CHUNK_SIZE) {
      return NextResponse.json({ error: 'Fragmento demasiado grande' }, { status: 400 })
    }

    const result = await appendImportChunk(id, offset, data)

    return NextResponse.json({ success: true, size: result.size })
  } catch (error) {
    console.error('Error uploading backup chunk:', error)
    const message = error instanceof Error ? error.message : 'Error al subir el fragmento'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
