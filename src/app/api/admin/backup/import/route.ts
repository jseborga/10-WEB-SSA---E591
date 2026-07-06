import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { importBackup } from '@/lib/backup'

export const dynamic = 'force-dynamic'

const MAX_BACKUP_SIZE = 1024 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const unauthorized = await requireAdmin(request)

    if (unauthorized) {
      return unauthorized
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Debes adjuntar el archivo de backup (.tar)' }, { status: 400 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    if (file.size > MAX_BACKUP_SIZE) {
      return NextResponse.json({ error: 'El backup supera el límite de 1 GB' }, { status: 400 })
    }

    const archive = Buffer.from(await file.arrayBuffer())
    const summary = await importBackup(archive)

    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('Error importing backup:', error)
    const message = error instanceof Error ? error.message : 'Error al importar el backup'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
