import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createImportUpload } from '@/lib/backup'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const upload = await createImportUpload()

    return NextResponse.json({ success: true, id: upload.id })
  } catch (error) {
    console.error('Error starting backup import:', error)
    return NextResponse.json({ error: 'Error al iniciar la subida del backup' }, { status: 500 })
  }
}
