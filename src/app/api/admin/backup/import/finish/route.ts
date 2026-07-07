import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { finishImportUpload } from '@/lib/backup'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const url = new URL(request.url)
    const id = url.searchParams.get('id') || ''

    const summary = await finishImportUpload(id)

    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('Error importing backup:', error)
    const message = error instanceof Error ? error.message : 'Error al importar el backup'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
